import type { StoredSourceObservation } from '@age/source-observation';

import type { OperatorWorkspaceRuntime } from './operator-workspace-runtime';
import { resolveBusinessScope } from './operator-workspace';

/**
 * Reading what peer products have OBSERVED, on behalf of a surface (ADR-0069).
 *
 * ⚠️ **WHY THIS IS AN OPERATION AND NOT A SCREEN CONCERN.** `readStoredSnapshot`
 * is the same shape for the same reason: the rules about scope, about what an
 * empty answer means, and about a row that will not read back are rules, not
 * rendering. A screen that re-derived them would be a second implementation of
 * each, and the second copy is always the one that gets relaxed.
 *
 * 🚫 **IT CANNOT WRITE, AND NOT BECAUSE IT DECLINES TO.** `ObservationReadPort`
 * carries one read and a close. There is no `append` on it to call and no
 * branch that could acquire one — a read surface holding a live append handle is
 * a relay waiting to happen (ADR-0046 D7, ADR-0055 D2). 🛑 The operator-mediated
 * relay is a separate act, on a separate path, with its own gate.
 *
 * 🛑 **AN EMPTY ANSWER IS A NAMED STATE CARRYING ITS REASON**, 🚫 never an empty
 * panel, never a zero, never "no issues". Nothing has relayed an observation is
 * a statement about WHAT HAS BEEN RELAYED — 🚫 not about the business, and
 * 🚫 not about what any peer product would have found. This is
 * `detectContradictions`' failure mode restated: an absent look must never
 * render as a completed look that found nothing.
 *
 * ⚠️ **ORDER IS LOAD-BEARING**, as in `readStoredSnapshot`: the client record is
 * resolved BEFORE a connection is opened, because a request with no scope has no
 * business opening a database connection. An unknown business must cost nothing
 * and reach nothing.
 *
 * 🚫 **READING AN OBSERVATION IS NOT BELIEVING IT** (ADR-0069 D5). Nothing here
 * scores, ranks, dedupes, prefers a source or moves a BIF field.
 */

/**
 * The one read, and the means to shut the connection down again.
 *
 * ⚠️ A PORT, NOT AN IMPLEMENTATION. The surface supplies it; a test binds an
 * in-memory one. 🚫 There is no second reader of `source_observations` in this
 * repository and this interface must never become one.
 *
 * 🚫 There is no `findByObservationId` and no `listForSourceSystem`. Reading is
 * by organisation, which is the only scope a screen has needed — and addressing
 * one observation by id is how a surface starts reconciling AGE's copy against
 * the source system's, which is not a thing AGE does.
 */
export interface ObservationReadPort {
  readonly listForOrganization: (
    organizationId: string,
  ) => Promise<ReadonlyArray<StoredSourceObservation>>;
  readonly close: () => Promise<void>;
}

/**
 * How the surface acquires the port.
 *
 * A function, not a value, for the same reason `readStoredSnapshot` takes one:
 * an unknown client must not have opened a connection, which means the
 * connection cannot exist before that check has run. ⚠️ It may THROW — a
 * missing or owner-pointing datasource variable refuses above
 * `new PrismaClient(` — and that throw is caught here and named, 🚫 never
 * crashed through to a blank screen.
 */
export type OpenObservationRead = () => ObservationReadPort | Promise<ObservationReadPort>;

/**
 * Narrows a wider read façade down to the one read this operation may perform.
 *
 * 🚫 It rebinds rather than spreading: a spread would carry every other property
 * the façade grows later — an `append` among them — silently, and the point is
 * that it does not.
 */
export function narrowObservationRead(connection: ObservationReadPort): ObservationReadPort {
  return {
    listForOrganization: (organizationId) => connection.listForOrganization(organizationId),
    close: () => connection.close(),
  };
}

export type RelayedObservationsOutcome =
  | {
      readonly kind: 'read';
      /** ⚠️ Newest-observed first, as stored. 🚫 Not ranked and 🚫 not scored. */
      readonly observations: ReadonlyArray<StoredSourceObservation>;
      /** Echoed back so the operator can see the scope was DERIVED, not typed. */
      readonly organizationId: string;
    }
  /** 🛑 Nothing has been relayed. 🚫 NEVER "no findings" and 🚫 never a zero. */
  | { readonly kind: 'none-relayed'; readonly reason: string }
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'refused'; readonly reason: string };

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * 🚫 A statement about the RELAY, never about the business and never about the
 * peer products.
 *
 * ⚠️ It says so explicitly, because "no peer product has relayed anything" and
 * "every peer product looked and found nothing" are indistinguishable from here
 * — and only the second would be a finding. AGE has no basis for the second and
 * must not let a screen imply it.
 */
export const NONE_RELAYED_REASON =
  'No source system has relayed an observation for this business. That is a statement about what ' +
  'has reached AGE and not about the business: a peer product that has never been relayed, one ' +
  'that did not run, and one that ran and found nothing all look identical from here. Nothing ' +
  'has been assessed and nothing is implied.';

export async function readRelayedObservations(
  runtime: OperatorWorkspaceRuntime,
  openRead: OpenObservationRead,
  entitledOrganizationId: string,
  clientId: string,
): Promise<RelayedObservationsOutcome> {
  const scope = resolveBusinessScope(runtime, entitledOrganizationId, clientId);
  if (scope.kind === 'not-configured') {
    return { kind: 'not-configured', variable: scope.variable };
  }
  if (scope.kind === 'refused') {
    return { kind: 'refused', reason: scope.reason };
  }
  if (scope.kind === 'unknown-client') {
    return {
      kind: 'refused',
      // ⚠️ Deliberately NOT the wording `operator-workspace.ts` uses: that
      // sentence is a marker proving `resolveBusinessScope` has exactly one
      // implementation, and repeating it here would make this module look like
      // a second one. It calls that function rather than repeating it.
      reason:
        'That business is not in the client record file, so there is no scope to read relayed ' +
        'observations under. Nothing is guessed: the organization is only ever read off the ' +
        'record.',
    };
  }

  let port: ObservationReadPort;
  try {
    port = await openRead();
  } catch (error) {
    // ⚠️ A deployment fault, named as one. 🚫 The message never carries a
    // connection string — it passes through whatever named the variable.
    return { kind: 'refused', reason: messageOf(error) };
  }

  let observations: ReadonlyArray<StoredSourceObservation>;
  try {
    // ⚠️ ONE unreadable row refuses the WHOLE read, in the repository below.
    // That throw arrives here and becomes a refusal — 🚫 never a shorter list,
    // because a list missing rows with no sign of it is worse than no list.
    observations = await port.listForOrganization(scope.client.organizationId);
  } catch (error) {
    return {
      kind: 'refused',
      reason:
        `Relayed observations could not be read back: ${messageOf(error)} Nothing is shown, ` +
        'because a row that failed validation is not a row AGE can report on in part.',
    };
  } finally {
    // Always released, including when the read throws.
    await port.close();
  }

  if (observations.length === 0) {
    return { kind: 'none-relayed', reason: NONE_RELAYED_REASON };
  }

  return { kind: 'read', observations, organizationId: scope.client.organizationId };
}
