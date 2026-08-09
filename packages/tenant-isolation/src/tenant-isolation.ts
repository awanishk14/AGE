import { ClientContext } from '@age/capability-kit';
import type { AuthenticatedOrganizationId } from '@age/entitlement';

/**
 * ADR-0061 **A6 item 5** — tenant isolation, as the read path's own rule.
 *
 * 🛑 **THIS IS NOT WRITTEN AGAINST RLS, AND MUST NEVER BE.** A6 asks for this
 * item in those words, and ADR-0046 D5 says why: row-level security is a
 * **coherence** constraint, 🚫 not an authorization boundary. The policy checks
 * that the declared scope and the row agree — and it does that correctly. What
 * it cannot check is whether the declared scope is the caller's OWN, because the
 * transaction-local setting is derived from the very key the caller supplied.
 * Hand the stack a `client-b` key and the policy admits `client-b` rows, exactly
 * as designed.
 *
 * ⚠️ **THAT IS FINDING 3, AND THIS IS WHAT CLOSES IT.**
 * `ClientContextBoundScoredBifSnapshotRepository` already makes it impossible to
 * *express* a query outside the context it was constructed with. The remaining
 * question is where that context came from, and until A2 there was no answer: a
 * `ClientContext` is two strings, and any caller can build one. Now there is an
 * authenticated organization, so the rule can be stated: **a context is admitted
 * only if the organization it names is the one the session speaks for.**
 *
 * 🚫 **A MISMATCH IS REFUSED, 🚫 NEVER NARROWED.** Silently rewriting the
 * organization to the session's would turn a cross-tenant read attempt into a
 * successful ordinary read, and nothing anywhere would record that it happened.
 * The caller asked for another tenant's data; that is the event.
 *
 * ⚠️ **ROWS ARE CHECKED ON THE WAY BACK OUT TOO.** A stored row is untrusted
 * input (ADR-0034), and "the query was scoped, so the rows must be" is precisely
 * the assumption that makes a single mis-built adapter, view or join invisible.
 * The check is cheap and the failure it catches is silent.
 *
 * 🚫 **THERE IS NO ADMIN ARM HERE.** ADR-0062 D3 — admin is never a bypass. An
 * administrator reading a tenant's rows still reads them as that tenant, through
 * a session that says so.
 *
 * Pure: no clock, no I/O, no database, no ids. It decides and stores nothing.
 */

/** Refusal raised when a read would cross a tenant boundary. */
export class TenantIsolationRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantIsolationRefusedError';
  }
}

export interface AcceptSessionScopedClientContextInput {
  /** The scope the caller is asking to operate in. ⚠️ Untrusted: two strings. */
  readonly requested: ClientContext;
  /**
   * The organization the session speaks for.
   *
   * ⚠️ Its type cannot be produced from a string, so a request parameter cannot
   * reach this argument (`authenticatedOrganizationIdOf` is the only source).
   */
  readonly organizationId: AuthenticatedOrganizationId;
}

/**
 * Admits a `ClientContext` for use, or refuses it.
 *
 * ⚠️ Returns a **new** context built from the session's organization and the
 * requested client, so what flows onward cannot be a caller-held object that is
 * mutated afterwards.
 *
 * @throws {TenantIsolationRefusedError} if the context names another
 *         organization, or either identifier is blank.
 */
export function acceptSessionScopedClientContext(
  input: AcceptSessionScopedClientContextInput,
): ClientContext {
  const { requested, organizationId } = input;

  const clientId = requested.clientId.trim();
  if (clientId === '') {
    throw new TenantIsolationRefusedError(
      'A client identifier is required to read within a tenant. A blank one is not "all ' +
        'clients" — there is no such scope.',
    );
  }

  if (organizationId.trim() === '') {
    throw new TenantIsolationRefusedError(
      'The session names no organization. That is a broken session, 🚫 not an unrestricted one.',
    );
  }

  if (requested.organizationId !== organizationId) {
    // 🚫 Names neither organization: one of them is somebody else's tenant, and
    // a refusal that prints it has put a real tenant in a log (ADR-0054 D3).
    throw new TenantIsolationRefusedError(
      'Refused: that request names an organization other than the one this session speaks for. ' +
        'It is refused rather than narrowed, because narrowing would turn a cross-tenant read ' +
        'into an ordinary one that nobody ever hears about.',
    );
  }

  return new ClientContext(clientId, organizationId);
}

/** The scope fields every stored row carries. */
export interface TenantScopedRow {
  readonly clientId: string;
  readonly organizationId: string;
}

/**
 * Refuses any row that did not come from the session's own tenant.
 *
 * ⚠️ **THE POINT IS THE ROW THAT SHOULD NOT BE THERE.** If the query was built
 * correctly this never fires — which is the argument for having it, not against
 * it: the day it fires is the day an adapter, a view or a policy stopped being
 * what everyone assumed.
 *
 * @throws {TenantIsolationRefusedError} if any row belongs to another tenant.
 */
export function assertRowsWithinTenant(
  rows: readonly TenantScopedRow[],
  organizationId: AuthenticatedOrganizationId,
  subject: string,
): void {
  const named = subject.trim();
  if (named === '') {
    throw new TenantIsolationRefusedError(
      'The subject of a tenant check is required: a refusal that does not say what was being ' +
        'read cannot be acted on.',
    );
  }

  for (const row of rows) {
    if (row.organizationId !== organizationId) {
      // 🚫 Neither the row's organization nor its client is named. Position
      // only: the caller knows what it asked for.
      throw new TenantIsolationRefusedError(
        `Refused: the store returned a ${named} belonging to another organization. The read was ` +
          'scoped, so this is not a caller mistake — something below the query is not what it ' +
          'is assumed to be, and the rows are discarded rather than shown.',
      );
    }
  }
}

/**
 * The single-row form. ⚠️ `null` passes through unchanged: a scoped query that
 * finds nothing is the ordinary answer, and 🚫 must never be dressed up as an
 * error — "no such row here" is exactly what another tenant's row should look
 * like from the outside.
 *
 * A row that arrives belonging to somebody else is the other case entirely: not
 * a caller asking for too much, but the store answering wrongly. It refuses.
 */
export function acceptRowWithinTenant<TRow extends TenantScopedRow>(
  row: TRow | null,
  organizationId: AuthenticatedOrganizationId,
  subject: string,
): TRow | null {
  if (row === null) return null;

  assertRowsWithinTenant([row], organizationId, subject);
  return row;
}
