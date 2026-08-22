import { notFound, redirect } from 'next/navigation';

import {
  decideAccess,
  platformScope,
  scopeForMembership,
  type AccessScope,
  type Capability,
} from '@age/access-scope';
import type { SessionPrincipal, VerifiedSession } from '@age/session-store';
import { decideSignIn } from '@age/sign-in-directory';

import { readDirectoryEntryByAccount } from './operator-environment';
import { requireLivePlatformMembership } from './platform-membership-reread';
import { assessRequestSession, requireVerifiedSession } from './session-boundary';

/**
 * **THE SCOPE BOUNDARY** — ADR-0079 §6 slice 4, and the thing that makes
 * *"being admitted is being authorized"* stop being true.
 *
 * 🛑 **THIS IS THE ONE MODULE IN THE PRODUCT THAT IMPORTS `@age/access-scope`,
 * AND A GUARD PINS IT BY NAME.** Slice 1 shipped that package with the guard
 * *"this package has no caller yet"*; slice 4 NARROWED that guard to one
 * permitted importer rather than deleting it, because a scope decision reachable
 * from sixteen call sites is sixteen chances for one of them to ask a slightly
 * different question. 🚫 Do not import `@age/access-scope` anywhere else — add
 * the capability here instead.
 *
 * 🛑 **THE SCOPE IS READ FROM THE DATABASE ON EVERY REQUEST, 🚫 NEVER FROM A
 * TOKEN CLAIM** (ADR-0079 §2 property 2). A demoted, revoked or disabled
 * operator loses their reach on the NEXT request, 🚫 not at token expiry. ⚠️ AGE
 * already does exactly this for `revokedAt` — this makes the membership agree
 * with it, and it is the reason there is 🚫 no `scope` column on
 * `operator_sessions`: *a flag on the session is precisely how a bypass
 * arrives* (`@age/entitlement`, unchanged).
 *
 * 🛑 **IT IS THE SAME ADMISSION DECISION SIGN-IN TOOK.** `decideSignIn` is
 * called again here over rows read again — 🚫 not a second, gentler re-check.
 * Two implementations of "may this person be here" is how the two drift, and the
 * copy that gets relaxed still passes its own tests.
 *
 * 🚫 **A REFUSAL LEAVES BY THROWING, EXACTLY AS THE SESSION BOUNDARY DOES.**
 * There is no falsy return value a caller could forget to check, and no way to
 * write the call and carry on. 🚫 Do not wrap it in a `try`/`catch`.
 *
 * ⚠️ **A REFUSAL IS AN OPAQUE 404, 🚫 NOT A "FORBIDDEN"** (ADR-0079 §2 property
 * 4). Absence and denial must be indistinguishable, or a client learns how many
 * sibling clients its agency has by counting which ids answer differently.
 *
 * 🚫 **NO EFFECTS LIVE HERE.** The read is `operator-environment.ts`'s, the
 * decision is `@age/access-scope`'s, and the admission rule is
 * `@age/sign-in-directory`'s. This module composes the three and holds no clock,
 * no database and no environment of its own.
 */

/**
 * What a request has proved: who is asking, and how far they can see.
 *
 * 🛑 **THE PRINCIPAL, 🚫 NOT A SESSION** (ADR-0083 D1). A caller that wants
 * an organization has to NARROW to the tenant arm to get one, because the
 * platform arm ❌ does not have the field. ⚠️ That is the whole reason option B
 * was chosen over a nullable column: the check cannot be forgotten, because
 * there is nothing to forget to check.
 */
export interface ScopedRequest {
  readonly principal: SessionPrincipal;
  readonly scope: AccessScope;
}

/**
 * What a request has proved once it has passed {@link requireScopedAccess}.
 *
 * 🛑 **THE TENANT IS IN THE TYPE, BECAUSE THE GATE ALREADY PROVED IT.** The
 * fourteen actions behind that gate read `scoped.session.organizationId`, and
 * their code has ❌ not moved a byte across ADR-0083 (D2) — not because the
 * change was avoided, but because a caller past a gate that refuses a platform
 * principal provably holds a tenant one. ⚠️ The narrowing happens ONCE, at the
 * gate, 🚫 rather than fourteen times behind it.
 */
export interface TenantScopedRequest {
  readonly session: VerifiedSession;
  readonly scope: AccessScope;
}

/**
 * Re-derives this request's scope from the store.
 *
 * ⚠️ Exported so a screen can ask what it may RENDER without also naming a
 * capability. 🚫 A caller that wants to act must still use
 * {@link requireScopedAccess} — knowing your own scope is not permission.
 */
export async function requireRequestScope(): Promise<ScopedRequest> {
  const decision = await assessRequestSession();

  // ⚠️ The same destination `requireVerifiedSession` sends a refusal to, and
  // 🚫 for the same reason: what was wrong with a credential is not a thing an
  // unauthenticated caller is told.
  if (decision.kind !== 'admitted') redirect('/sign-in');

  const principal = decision.principal;

  // 🛑 **THE BRANCH BETWEEN THE TWO PRINCIPALS, AND ADR-0083 D4 SAYS IT LIVES
  // HERE AND NOWHERE ELSE.** `platformScope()` takes no arguments and is
  // reachable only BY NAME — 🚫 never by parsing a row, which
  // `scopeForMembership` refuses outright. So this line is the only way a
  // platform scope can come into existence in the product, and it is reached
  // only by a principal the store already verified as having no organization.
  //
  // 🛑 **THE PLATFORM ARM RE-READS TOO, SINCE ADR-0089.** It did not, and the
  // gap was real: the only fenced platform read was keyed by the Google-verified
  // address, a request does not have one, and the organization-scoped read
  // cannot be borrowed — passing the pinned organization here is exactly the
  // substitution ADR-0082 D4 forbids, and it would read an agency's people.
  // ⚠️ So the re-read is keyed by the account id the session ALREADY PROVED,
  // and 🚫 there is no parameter on it through which a tenant could be supplied.
  if (principal.scope === 'platform') {
    await requireLivePlatformMembership(principal.session.accountId);

    return Object.freeze({ principal, scope: platformScope() });
  }

  const session = principal.session;

  const entry = await readDirectoryEntryByAccount(session.organizationId, session.accountId);

  // 🛑 THE SAME DECISION, OVER FRESHLY READ ROWS. An operator whose membership
  // was revoked between sign-in and now is refused HERE, with the session row
  // still perfectly valid — because a session says who, and a membership says
  // how far.
  const admission = decideSignIn(entry, session.organizationId);

  if (admission.outcome === 'refused') {
    // ⚠️ NAMES NO REASON IN THE URL. The operator is sent back to the door; what
    // changed about their access is a thing their operator knows and the
    // console does not disclose to a browser mid-session.
    redirect('/sign-in?refused=not-provisioned');
  }

  const scoped = scopeForMembership(
    {
      scopeKind: admission.operator.scopeKind,
      roleBundle: admission.operator.roleBundle,
      organizationId: admission.operator.organizationId,
      clientId: admission.operator.clientId,
    },
    session.organizationId,
  );

  if (scoped.outcome === 'refused') {
    // 🚫 A membership AGE cannot express as a scope is REFUSED, 🚫 never
    // approximated by the nearest one it can. The reason names a position and
    // never an identifier, and it is not shown to the browser.
    redirect('/sign-in?refused=not-provisioned');
  }

  return Object.freeze({ principal, scope: scoped.scope });
}

/**
 * The gate every browser-reachable action passes through. Returns the scoped
 * request, or does not return.
 *
 * 🛑 **THE SUBJECT'S AGENCY IS THE SESSION'S ORGANIZATION, 🚫 NEVER AN
 * ARGUMENT** (AGE-INV-SEL-1). A caller may name a `clientId` — that is a filter
 * applied INSIDE the entitlement — and 🚫 may never name the tenant it wants the
 * filter applied within.
 *
 * ⚠️ **`clientId: null` MEANS THE AGENCY ITSELF**, which is a different fact
 * from a blank string; `decideAccess` refuses a blank rather than reading it as
 * "any client".
 */
export async function requireScopedAccess(
  capability: Capability,
  clientId: string | null,
): Promise<TenantScopedRequest> {
  const scoped = await requireRequestScope();

  // 🛑 **A PLATFORM PRINCIPAL IS REFUSED HERE, BY NAME, AND 🚫 NOT BECAUSE IT
  // LACKS THE CAPABILITY.** `platformScope()` holds every atom; what it does not
  // have is a SUBJECT — `decideAccess` compares a scope against an agency, and
  // this principal speaks for none. ⚠️ The tempting one-liner is to pass the
  // deployment's pinned organization as `agencyId`; that would answer a question
  // about a tenant nobody named, and ADR-0083 authorizes the SHAPE of this
  // principal and 🚫 explicitly **not a reach** for it.
  //
  // ⚠️ **THIS IS A NARROWING, 🚫 NOT A WIDENED GUARD.** Before this slice a
  // platform principal could not be admitted at all; after it, it is admitted,
  // knows its own scope, and still reaches nothing. 🚫 Nothing became reachable
  // that was not reachable before.
  if (scoped.principal.scope === 'platform') {
    notFound();
  }

  const session = scoped.principal.session;

  const decision = decideAccess({
    scope: scoped.scope,
    capability,
    subject: { agencyId: session.organizationId, clientId },
  });

  if (decision.answer === 'refused') {
    // 🛑 AN OPAQUE 404. 🚫 Not a 403, and 🚫 not an empty result: an empty result
    // is indistinguishable from an ordinary one, and nobody would ever hear that
    // a boundary was tested.
    notFound();
  }

  return Object.freeze({ session, scope: scoped.scope });
}

/**
 * What a request has proved once it has passed {@link requireClientRendering}.
 *
 * 🛑 **THE CLIENT IS IN THE TYPE, AND IT CAME FROM THE MEMBERSHIP** (ADR-0087).
 * ⚠️ There is deliberately no way to construct this from a URL segment: the gate
 * below is the only producer, and it reads `clientId` off the SCOPE it derived
 * from the store, 🚫 never off a parameter the caller supplied.
 */
export interface ClientScopedRequest {
  readonly session: VerifiedSession;
  /** The agency the client sits beneath — the session's own organization. */
  readonly organizationId: string;
  /** 🛑 The ONE client this request may see. 🚫 Never a list, 🚫 never a wildcard. */
  readonly clientId: string;
}

/**
 * The gate for the client rendering — ADR-0087.
 *
 * 🛑 **IT TAKES NO ARGUMENTS, AND THAT IS THE DECISION.** Every other gate in
 * this module accepts a `clientId` because elsewhere naming one is a FILTER
 * applied inside an entitlement (AGE-INV-SEL-1). A client viewer has exactly one
 * subject, so there is nothing to filter — and a parameter here would be a slot
 * in which to name somebody else's client. 🚫 Do not add one "for symmetry".
 *
 * 🛑 **ANY SCOPE THAT IS NOT `client` IS REFUSED, INCLUDING THE WIDER ONES.** An
 * agency operator and a platform operator are both turned away, 🚫 not because
 * they lack reach — they have more — but because this screen renders a subject
 * they do not have. ⚠️ Sending a platform principal to `/platform` instead would
 * disclose that this route exists at all; the refusal is the same opaque 404
 * every other boundary here produces.
 *
 * ⚠️ **THE CAPABILITY IS STILL ASKED FOR, OVER A SCOPE THAT OBVIOUSLY HOLDS
 * IT.** `client-viewer` carries `rendering.client` by construction, so this
 * check cannot fail today — and it is written anyway, because the day a bundle
 * is edited is the day it must fail. 🚫 A gate that skips the question because
 * it knows the answer is a gate that stops being one.
 */
export async function requireClientRendering(): Promise<ClientScopedRequest> {
  const scoped = await requireRequestScope();

  // 🛑 THE NARROWING IS THE COMPILER'S. A platform principal has no
  // `organizationId`, so the read below is unreachable until this line has
  // proved the scope is a client's — and a client scope only ever arrives on
  // the tenant arm, because `scopeForMembership` refuses to parse any other.
  if (scoped.scope.kind !== 'client' || scoped.principal.scope !== 'tenant') {
    notFound();
  }

  const session = scoped.principal.session;

  const decision = decideAccess({
    scope: scoped.scope,
    capability: 'rendering.client',
    // 🛑 **THE SUBJECT IS THE SCOPE'S OWN CLIENT.** ⚠️ This looks circular and is
    // not: `decideAccess` re-accepts both, so a blank identifier smuggled into a
    // membership row is refused here rather than compared against itself. 🚫 The
    // agency is the SESSION's organization, never the scope's, so a row that
    // disagreed with the session it arrived under cannot grant anything.
    subject: { agencyId: session.organizationId, clientId: scoped.scope.clientId },
  });

  if (decision.answer === 'refused') notFound();

  return Object.freeze({
    session,
    organizationId: session.organizationId,
    clientId: scoped.scope.clientId,
  });
}

/**
 * The gate every AGENCY-facing page stands behind — ADR-0088 §3a.
 *
 * 🛑 **IT EXISTS BECAUSE `requireVerifiedSession` CANNOT TELL A CLIENT FROM AN
 * AGENCY OPERATOR, AND FROM THIS SLICE ONWARDS BOTH CAN SIGN IN.** That
 * boundary proves a SESSION is valid; it 🚫 does not re-read the membership. Up
 * to ADR-0087 that was harmless, because `decideSignIn` refused a client at the
 * door. Lifting that refusal without this gate would have handed every client
 * the whole agency — `app/page.tsx` reads `readBusinessesView` over the
 * organization, 🚫 not over a subject.
 *
 * ⚠️ **IT COMPOSES, 🚫 IT DOES NOT REIMPLEMENT.** The session comes from
 * `requireVerifiedSession` so the ADR-0085 platform acting-organization arm is
 * reached by exactly one code path, and the scope comes from
 * `requireRequestScope` so there is still ONE re-derivation of "how far".
 *
 * 🛑 **A CLIENT IS REDIRECTED, 🚫 NOT REFUSED, AND THE DIFFERENCE IS
 * DELIBERATE.** This person IS signed in and IS provisioned; a 404 here would be
 * the ADR-0084 defect in a third costume — a working session rendered as a
 * failed one. The opaque 404 is for a screen that is NOT THEIRS; `/` is not
 * not-theirs, it is simply not where they live.
 *
 * ⚠️ **A PLATFORM PRINCIPAL PASSES, AND THAT IS ADR-0085 WORKING.** It has
 * already named an organization and holds an ordinary tenant session carrying
 * 🚫 no extra power; `requireRequestScope` reports `platformScope()` for it,
 * which is 🚫 not a client scope, so it renders.
 */
export async function requireAgencyRendering(): Promise<VerifiedSession> {
  // ⚠️ FIRST, so an unadmitted caller is sent to the door by the same line as
  // before and 🚫 the store below is never asked about them.
  const session = await requireVerifiedSession();

  const scoped = await requireRequestScope();

  // 🛑 THE NARROWING IS THE COMPILER'S AGAIN: `scope.kind` is only reachable
  // once the principal is known to be a tenant's, and a client scope can arrive
  // 🚫 no other way — `scopeForMembership` refuses to parse one from anything
  // else, and `platformScope()` is reachable only by name.
  if (scoped.principal.scope === 'tenant' && scoped.scope.kind === 'client') {
    redirect('/client');
  }

  return session;
}
