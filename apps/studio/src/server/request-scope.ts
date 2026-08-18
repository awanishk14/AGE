import { notFound, redirect } from 'next/navigation';

import {
  decideAccess,
  scopeForMembership,
  type AccessScope,
  type Capability,
} from '@age/access-scope';
import type { VerifiedSession } from '@age/session-store';
import { decideSignIn } from '@age/sign-in-directory';

import { readDirectoryEntryByAccount } from './operator-environment';
import { requireVerifiedSession } from './session-boundary';

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

/** What a request has proved: who is asking, and how far they can see. */
export interface ScopedRequest {
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
  const session = await requireVerifiedSession();

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

  return Object.freeze({ session, scope: scoped.scope });
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
): Promise<ScopedRequest> {
  const scoped = await requireRequestScope();

  const decision = decideAccess({
    scope: scoped.scope,
    capability,
    subject: { agencyId: scoped.session.organizationId, clientId },
  });

  if (decision.answer === 'refused') {
    // 🛑 AN OPAQUE 404. 🚫 Not a 403, and 🚫 not an empty result: an empty result
    // is indistinguishable from an ordinary one, and nobody would ever hear that
    // a boundary was tested.
    notFound();
  }

  return scoped;
}
