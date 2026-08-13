import type { StoredSourceObservation } from '@age/source-observation';

import { PrismaSourceObservationRepository } from './prisma-source-observation-repository';
import type {
  SourceObservationScope,
  SourceObservationScopeRunner,
} from './source-observation-scope-runner';

/**
 * The observation repository as it must be used once row-level security is on:
 * every operation inside a transaction that has applied the scope setting.
 *
 * ⚠️ **WITHOUT THIS, NOTHING WORKS AND NOTHING SAYS SO.** Under
 * `FORCE ROW LEVEL SECURITY` an unscoped `SELECT` does not error — it returns
 * ZERO ROWS. A screen reading through the bare repository would therefore
 * render "no source system has relayed an observation" for a business whose
 * observations are sitting in the table. 🛑 That is the single most dangerous
 * failure mode this whole track has: a missing scope looking exactly like an
 * honest empty answer. An unscoped `INSERT` fails loudly; an unscoped read
 * lies quietly.
 *
 * 🛑 **SCOPE COMES FROM THE CALLER, NEVER FROM THE PAYLOAD.** `append` derives
 * the scope from the observation's `organizationId` — the one field a caller
 * took off the operator's client record before assembling the record — and the
 * database then checks the same id again in the policy's `WITH CHECK`. So a
 * disagreement between what the transaction claims and what the row says is
 * rejected by PostgreSQL rather than trusted from the application.
 *
 * ⚠️ It implements the SAME two operations, unchanged. Callers see `append` and
 * `listForOrganization`; what changes is that each opens a scoped transaction
 * instead of issuing a bare query. 🚫 It is not wider than the repository it
 * wraps: still no `update`, no `upsert`, no `delete`, no `findUnique`.
 *
 * 🚫 **STILL NOT AN AUTHORIZATION** (ADR-0046 D5). Entitlement runs above this.
 *
 * ⚠️ INERT: no clock, no randomness, no id generation, and no knowledge of how
 * a transaction is opened — that belongs to the runner.
 */
export class ScopedSourceObservationRepository {
  private readonly runner: SourceObservationScopeRunner;

  constructor(runner: SourceObservationScopeRunner) {
    this.runner = runner;
  }

  async append(observation: Readonly<StoredSourceObservation>): Promise<void> {
    return this.inScope({ organizationId: observation.organizationId }, (repository) =>
      repository.append(observation),
    );
  }

  async listForOrganization(
    organizationId: string,
  ): Promise<ReadonlyArray<StoredSourceObservation>> {
    return this.inScope({ organizationId }, (repository) =>
      repository.listForOrganization(organizationId),
    );
  }

  private async inScope<T>(
    scope: SourceObservationScope,
    operation: (repository: PrismaSourceObservationRepository) => Promise<T>,
  ): Promise<T> {
    return this.runner.runInScope(scope, (observations) =>
      // ⚠️ Built per transaction, over the TRANSACTION-BOUND delegate. A
      // repository constructed once in the field would hold a delegate from
      // outside every scope it was later used in.
      operation(new PrismaSourceObservationRepository(observations)),
    );
  }
}
