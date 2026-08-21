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
import { assessRequestSession } from './session-boundary';

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
  // 🚫 **NO DIRECTORY READ HAPPENS ON THIS ARM, AND THAT IS 🚫 NOT AN
  // OVERSIGHT.** The tenant re-read below exists to catch a membership revoked
  // since sign-in; the equivalent for a platform operator is a read this
  // console does ❌ not have — `readDirectoryEntryByAccount` is scoped by
  // organization, and there is none. ⚠️ Passing the pinned organization here
  // to "make the re-read work" is exactly the substitution ADR-0082 D4 forbids.
  // 🛑 The gap is REAL and is named in the checkpoint rather than papered over:
  // a platform membership revoked mid-session is caught at token expiry, 🚫 not
  // on the next request.
  if (principal.scope === 'platform') {
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
