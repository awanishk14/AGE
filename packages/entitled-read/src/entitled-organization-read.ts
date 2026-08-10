import { ClientContext } from '@age/capability-kit';
import {
  askEntitlement,
  authenticatedOrganizationIdOf,
  type Authentication,
  type EntitlementAnswer,
} from '@age/entitlement';
import { acceptSessionScopedClientContext } from '@age/tenant-isolation';

/**
 * ADR-0068 §0.1b — **the first real caller of `askEntitlement`**, on a READ path.
 *
 * 🛑 **THE POINT OF THIS MODULE IS THE ORDER, NOT THE FUNCTION.** ADR-0068 §0.1d
 * names the acceptance criterion: *the proof is a real `denied`, raised BEFORE a
 * query exists — 🚫 an empty result set is not a proof.* Everything here exists
 * so that a refused read cannot reach the point where a query is constructed,
 * and so the tests can demonstrate that rather than assert it.
 *
 * ⚠️ **A DENIAL IS RAISED, 🚫 NEVER RETURNED AS NO ROWS.** Returning `[]` would
 * make a refused cross-tenant read indistinguishable from a tenant that simply
 * has no data — the caller could not tell them apart, and neither could anyone
 * reading a log afterwards.
 *
 * ⚠️ **BOTH CHECKS RUN, AND NEITHER IS THE OTHER.** `askEntitlement` answers
 * *may this session act on this organization*; `acceptSessionScopedClientContext`
 * answers *is this context the session's own*. 🚫 Deleting either must fail a
 * test. And 🚫 neither is RLS, which is a coherence constraint (ADR-0046 D5) and
 * is 🚫 never the authorization here.
 *
 * 🚫 **THIS MODULE ISSUES NOTHING.** It verifies no credential, mints no
 * session, stores no row and provisions no operator. ADR-0068 §0.1c refuses each
 * of those by name, and a caller that already holds a `VerifiedSession` is the
 * only entry this has.
 *
 * 🚫 **NO `clientId` IS INFERRED AND NO SUBJECT IS WIDENED.** The subject asked
 * about is the ORGANIZATION (ADR-0062 D1); the client is carried through to the
 * query untouched, and a `client` subject remains `not-established` inside the
 * decision, where it belongs (ADR-0062 D2).
 *
 * Pure: no clock, no ids, no randomness, no I/O. The query is injected, so this
 * module never learns what a database is.
 */

/**
 * Raised when a read was not entitled.
 *
 * ⚠️ It carries the **answer**, so a caller can tell a decided `denied` from an
 * `not-established` that means AGE never had a way to look. 🚫 The two must not
 * collapse into one refusal type (ADR-0058 D2) — the first thing anyone adds to
 * a blanket refusal is a bypass to get past it.
 */
export class EntitlementRefusedError extends Error {
  /** 🚫 Never `granted`: a granted read does not raise. */
  readonly answer: Exclude<EntitlementAnswer, 'granted'>;
  /** The decision's own words, which 🚫 name no identifier (ADR-0054 D3). */
  readonly because: string;

  constructor(answer: Exclude<EntitlementAnswer, 'granted'>, because: string) {
    super(
      answer === 'denied'
        ? `Refused: this read is not entitled. ${because}`
        : `Not established: AGE cannot say whether this read is entitled. ${because}`,
    );
    this.name = 'EntitlementRefusedError';
    this.answer = answer;
    this.because = because;
  }
}

export interface EntitledReadInput<TResult> {
  /** What the caller has managed to prove about who is asking. */
  readonly authentication: Authentication;
  /** The scope the caller is asking to read in. ⚠️ Untrusted: two strings. */
  readonly requested: ClientContext;
  /**
   * Builds and runs the read.
   *
   * ⚠️ **IT IS A PARAMETER SO THAT IT CAN BE PROVEN NOT TO HAVE RUN.** A query
   * built inside this module could only be checked by inspecting its results,
   * which is exactly the empty-result-set non-proof ADR-0068 §4 refuses.
   */
  readonly openQuery: (context: ClientContext) => TResult;
}

/**
 * Answers the entitlement question, and only then opens the read.
 *
 * @throws {EntitlementRefusedError} when the answer is `denied` or
 *         `not-established` — raised **before** `openQuery` is called.
 * @throws {SessionRefusedError} when the session is not usable as one.
 * @throws {TenantIsolationRefusedError} when the context is not the session's.
 */
export function readWithinEntitlement<TResult>(input: EntitledReadInput<TResult>): TResult {
  const { authentication, requested, openQuery } = input;

  const decision = askEntitlement({
    authentication,
    // ⚠️ The subject is the ORGANIZATION (ADR-0062 D1). 🚫 Asking about the
    // client instead would be `not-established` always, which would read as a
    // working check that refuses everything.
    subject: { kind: 'organization', organizationId: requested.organizationId },
  });

  if (decision.answer !== 'granted') {
    // 🛑 NOTHING BELOW THIS LINE HAS RUN. No query, no context, no adapter.
    throw new EntitlementRefusedError(decision.answer, decision.because);
  }

  if (authentication.kind !== 'verified-session') {
    // ⚠️ Unreachable today: only the session arm can answer `granted`. It is
    // here because a future arm of `Authentication` would otherwise reach the
    // query with no session to scope it — and 🚫 a `granted` with nothing to
    // narrow by is the failure this whole module exists to prevent.
    throw new EntitlementRefusedError(
      'not-established',
      'The decision granted this read, but the authentication carries no session to scope it ' +
        'to. That is a contradiction, and it is refused rather than resolved.',
    );
  }

  const organizationId = authenticatedOrganizationIdOf(authentication.session);

  // ⚠️ The SECOND check, and 🚫 not a repetition of the first: it rebuilds the
  // context from the session, so what reaches the query cannot be a caller-held
  // object mutated after the decision was made.
  return openQuery(acceptSessionScopedClientContext({ requested, organizationId }));
}
