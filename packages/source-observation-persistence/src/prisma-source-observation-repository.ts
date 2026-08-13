import type { StoredSourceObservation } from '@age/source-observation';

import {
  type SourceObservationDelegate,
  isUniqueConstraintViolation,
} from './source-observation-delegate';
import { fromSourceObservationRow, toSourceObservationRow } from './source-observation-row';

/**
 * The durable adapter for relayed source observations (ADR-0069 deliverable 2,
 * this slice being the repository over that table).
 *
 * 🛑 **APPEND-ONLY, AND NOT BY CONVENTION.** There is no `update`, `upsert`,
 * `delete` or soft delete on this class or on the delegate it is handed. An
 * observation that turns out to be wrong is corrected by a LATER observation
 * that says so, 🚫 never by rewriting the record of what a source actually
 * reported.
 *
 * 🛑 **SCOPE IS AUTHORITATIVE, NEVER INFERRED.** Every read carries the
 * `organizationId`, so an observation recorded under one tenant is unreachable
 * under another because the query cannot be expressed without the scope. 🚫 The
 * adapter never reads scope out of the observation payload — and 🚫 there is no
 * `clientId` here at all, by shape (ADR-0062 D1).
 *
 * 🚫 **NOTHING HERE IS AN AUTHORIZATION.** Entitlement runs above this, and RLS
 * below it is coherence rather than authorization (ADR-0046 D5). A repository
 * that reads is not a repository that was allowed to.
 *
 * 🚫 **STORING AN OBSERVATION IS NOT BELIEVING IT** (ADR-0069 D5). No score,
 * status or confidence figure is read or written here, and there is deliberately
 * no `status`, `verified` or `accepted` column to set.
 *
 * ⚠️ It is INERT: no clock, no id generation, no connection management.
 * `observationId` and `recordedAt` are caller-supplied, so a test and a
 * production run produce the same row.
 */
export class PrismaSourceObservationRepository {
  private readonly observations: SourceObservationDelegate;

  constructor(observations: SourceObservationDelegate) {
    this.observations = observations;
  }

  /**
   * @throws when the id is re-used — the database's own answer, 🚫 never a
   *         read-then-write pre-check two concurrent relays would both pass.
   */
  async append(observation: Readonly<StoredSourceObservation>): Promise<void> {
    // ⚠️ Re-validated on the way IN as well as on the way out, and 🛑 THE ROW
    // THAT IS VALIDATED IS THE ROW THAT IS WRITTEN — validating the input object
    // and then writing a separately-built row would leave the mapping itself
    // unchecked. A caller that assembled a record by hand does not get to widen
    // the store's shape.
    const row = toSourceObservationRow(observation);
    fromSourceObservationRow(row);

    try {
      await this.observations.create({ data: row });
    } catch (error: unknown) {
      if (isUniqueConstraintViolation(error)) {
        throw new Error(
          'An observation is already recorded under that observation id. Observations are ' +
            'append-only and are never overwritten — a correction is a later observation, not a ' +
            'rewrite of what a source reported.',
        );
      }

      throw error;
    }
  }

  /**
   * Every observation relayed for one organisation, newest first.
   *
   * ⚠️ Ordered by `observedAt`, 🚫 NOT by `recordedAt`: an operator-mediated
   * relay records observations days after they were observed and in whatever
   * order the operator got to them, so recording order says nothing about the
   * world. `observationId` breaks ties so the order is reproducible.
   *
   * ⚠️ An empty list means NO OBSERVATION HAS BEEN RELAYED — 🚫 it is never
   * "nothing happened", and 🚫 never a clean bill of health. Rendering that
   * distinction is the caller's obligation.
   */
  async listForOrganization(
    organizationId: string,
  ): Promise<ReadonlyArray<StoredSourceObservation>> {
    const rows = await this.observations.findMany({
      where: { organizationId },
      orderBy: [{ observedAt: 'desc' }, { observationId: 'desc' }],
    });

    // 🚫 Not `flatMap` with a filter, and 🚫 no try/catch per row: one unreadable
    // row refuses the whole read. Dropping it would show the operator a shorter
    // list with no sign anything was missing.
    return Object.freeze(rows.map(fromSourceObservationRow));
  }
}
