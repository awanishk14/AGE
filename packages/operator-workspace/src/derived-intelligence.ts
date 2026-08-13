import { deriveIntelligenceFromStoredObservations } from '@age/derived-intelligence';
import { deriveModelledSubjects } from '@age/observation-association';
import { presentDerivedIntelligence, type DerivedIntelligenceView } from '@age/studio-shell';

import type { ObservationReadPort, OpenObservationRead } from './relayed-observations';
import type { OpenSnapshotRead, SnapshotReadPort } from './stored-snapshot';
import type { OperatorWorkspaceRuntime } from './operator-workspace-runtime';
import { resolveBusinessScope } from './operator-workspace';

/**
 * Reading what AGE CONCLUDES, on behalf of a surface (ADR-0069 D1/D2/D7).
 *
 * 🛑 **THIS IS THE ONLY OPERATION THAT READS TWO STORES**, and the order between
 * them is load-bearing: the business context FIRST, the observations second.
 * The context is what AGE models; without it there is no subject to admit an
 * observation against, and a derivation run over an empty subject list would
 * report every relayed observation as unrelatable — a confident-looking answer
 * produced by AGE having no idea what the business is.
 *
 * 🛑 **NO STORED CONTEXT IS ITS OWN OUTCOME**, exactly as `contextNotFound` is
 * its own exit code in the relay CLI. AGE holding no context means the
 * derivation **was never run**; reporting that as "nothing concluded" would
 * claim a check happened. 🚫 The two must never be collapsed.
 *
 * 🛑 **NO OBSERVATIONS IS *NOT* AN ERROR.** The projection over an empty list is
 * genuinely informative: it names every subject AGE models that nobody has
 * reported on, which is the honest shape of "AGE has never been told". 🚫 It is
 * never "no issues" — the view carries that sentence, and this operation must
 * not add a second, gentler one.
 *
 * 🚫 **IT CANNOT WRITE, AND NOT BECAUSE IT DECLINES TO.** Both ports carry
 * reads and a close; there is no `append` on either to call. Both are opened
 * only AFTER the client record resolves — an unknown business must cost nothing
 * and reach nothing, and it opens neither connection.
 *
 * 🚫 **IT CONCLUDES NOTHING ITSELF** (D1). It resolves scope, reads, and hands
 * both halves to the one deterministic rule. 🚫 It filters no observation,
 * drops no subject and orders nothing — a second place that decided any of
 * those would be a second rule, and the second copy is the one that gets
 * relaxed.
 *
 * 🚫 **NOTHING IS PERSISTED** (D2). The projection is recomputed on every read.
 */

export type DerivedIntelligenceOutcome =
  | {
      readonly kind: 'derived';
      readonly view: DerivedIntelligenceView;
      /** Echoed so the operator can see the scope was DERIVED, not typed. */
      readonly organizationId: string;
    }
  /**
   * 🛑 AGE holds no context under this BIF id, so the derivation NEVER RAN.
   * 🚫 Never rendered as an empty result and 🚫 never as "nothing concluded".
   */
  | { readonly kind: 'no-context'; readonly reason: string }
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'refused'; readonly reason: string };

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** 🚫 A statement about the QUERY, never about the business. */
const noContextReason = (bifId: string): string =>
  `AGE holds no stored business context under BIF id "${bifId}" for this business, so nothing ` +
  'was derived — the derivation did not run and found nothing, it never ran at all. A BIF id ' +
  'that was never captured under and a business that was never captured look identical from ' +
  'here, and neither is a statement about the business.';

export async function readDerivedIntelligence(
  runtime: OperatorWorkspaceRuntime,
  openContextRead: OpenSnapshotRead,
  openObservationRead: OpenObservationRead,
  clientId: string,
  bifId: string,
): Promise<DerivedIntelligenceOutcome> {
  const trimmedBifId = bifId.trim();
  if (trimmedBifId === '') {
    // 🚫 Never defaulted and never derived — the id was chosen at capture time,
    // and guessing one would query a scope nobody wrote to.
    return {
      kind: 'refused',
      reason:
        'A BIF id is required. AGE cannot derive it: the id was chosen when the business context ' +
        'was captured, and reading across snapshots to find it is not authorized.',
    };
  }

  const scope = resolveBusinessScope(runtime, clientId);
  if (scope.kind === 'not-configured') {
    return { kind: 'not-configured', variable: scope.variable };
  }
  if (scope.kind === 'refused') {
    return { kind: 'refused', reason: scope.reason };
  }
  if (scope.kind === 'unknown-client') {
    return {
      kind: 'refused',
      // ⚠️ Its own words, deliberately. The wording in `operator-workspace.ts`
      // is a marker proving `resolveBusinessScope` has exactly one
      // implementation; repeating it here would make this look like a second.
      reason:
        'That business is not in the client record file, so there is no scope to derive under. ' +
        'Nothing is guessed: the organization is only ever read off the record.',
    };
  }

  let contextPort: SnapshotReadPort;
  try {
    contextPort = await openContextRead();
  } catch (error) {
    // ⚠️ A deployment fault, named as one. 🚫 No connection string travels.
    return { kind: 'refused', reason: messageOf(error) };
  }

  let found;
  try {
    // ⚠️ A stored row is untrusted input; one that fails validation refuses the
    // whole read rather than being rendered in part.
    found = await contextPort.findLatest({
      clientId: scope.client.clientId,
      organizationId: scope.client.organizationId,
      bifId: trimmedBifId,
    });
  } catch (error) {
    return {
      kind: 'refused',
      reason:
        `The stored business context could not be read back: ${messageOf(error)} Nothing is ` +
        'derived, because a row that failed validation is not a row AGE can conclude from in part.',
    };
  } finally {
    await contextPort.close();
  }

  if (found === null) {
    return { kind: 'no-context', reason: noContextReason(trimmedBifId) };
  }

  // 🛑 ONLY NOW is the second connection opened. A business AGE holds no context
  // for never reaches the observation store — there is nothing it could be asked
  // that AGE could answer honestly.
  let observationPort: ObservationReadPort;
  try {
    observationPort = await openObservationRead();
  } catch (error) {
    return { kind: 'refused', reason: messageOf(error) };
  }

  let observations;
  try {
    // ⚠️ ONE unreadable row refuses the WHOLE read. 🚫 Never a shorter list: a
    // conclusion drawn from silently fewer observations is worse than none.
    observations = await observationPort.listForOrganization(scope.client.organizationId);
  } catch (error) {
    return {
      kind: 'refused',
      reason:
        `Relayed observations could not be read back: ${messageOf(error)} Nothing is derived, ` +
        'because a conclusion drawn from part of the evidence is not one AGE can stand behind.',
    };
  } finally {
    await observationPort.close();
  }

  return {
    kind: 'derived',
    view: presentDerivedIntelligence(
      deriveIntelligenceFromStoredObservations(
        deriveModelledSubjects(found.snapshot.context),
        observations,
      ),
    ),
    organizationId: scope.client.organizationId,
  };
}
