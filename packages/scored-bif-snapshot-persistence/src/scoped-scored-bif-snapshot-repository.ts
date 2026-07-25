import type {
  ScoredBifSnapshotKey,
  ScoredBifSnapshotRecord,
  ScoredBifSnapshotRepository,
  ScoredBifSnapshotSeriesKey,
} from '@age/business-discovery-contracts';

import { PrismaScoredBifSnapshotRepository } from './prisma-scored-bif-snapshot-repository';
import type {
  ScoredBifSnapshotScope,
  ScoredBifSnapshotScopeRunner,
} from './scored-bif-snapshot-scope-runner';

/**
 * The durable repository as it must be used once row-level security is on
 * (ADR-0033 D7): every operation inside a transaction that has applied both
 * scope settings.
 *
 * It implements the SAME port, unchanged. Callers see `append` and the three
 * reads; what changes is that each one now opens a scoped transaction instead
 * of issuing a bare query. `PrismaScoredBifSnapshotRepository` is unmodified and
 * still usable directly against a table without RLS.
 *
 * SCOPE COMES FROM THE KEY, NOT THE PAYLOAD. Each method derives the scope from
 * the `clientId`/`organizationId` of the key or record it was given — the two
 * ids a caller took off its `ClientContext`. The snapshot's `context` is never
 * consulted, and it carries no client or organization to consult. The database
 * then checks the same two ids again in the policy, so a mismatch between what
 * the transaction claims and what the row says is rejected by PostgreSQL rather
 * than trusted from the application.
 *
 * IT IS STILL INERT. No clock, no randomness, no id generation, and no
 * knowledge of how a transaction is opened — that belongs to the runner.
 */
export class ScopedScoredBifSnapshotRepository implements ScoredBifSnapshotRepository {
  private readonly runner: ScoredBifSnapshotScopeRunner;

  constructor(runner: ScoredBifSnapshotScopeRunner) {
    this.runner = runner;
  }

  async append(record: ScoredBifSnapshotRecord): Promise<void> {
    return this.inScope(record, (repository) => repository.append(record));
  }

  async findBySnapshotId(key: ScoredBifSnapshotKey): Promise<ScoredBifSnapshotRecord | null> {
    return this.inScope(key, (repository) => repository.findBySnapshotId(key));
  }

  async listSeries(
    key: ScoredBifSnapshotSeriesKey,
  ): Promise<ReadonlyArray<ScoredBifSnapshotRecord>> {
    return this.inScope(key, (repository) => repository.listSeries(key));
  }

  async findLatest(key: ScoredBifSnapshotSeriesKey): Promise<ScoredBifSnapshotRecord | null> {
    return this.inScope(key, (repository) => repository.findLatest(key));
  }

  private async inScope<T>(
    scope: ScoredBifSnapshotScope,
    operation: (repository: PrismaScoredBifSnapshotRepository) => Promise<T>,
  ): Promise<T> {
    return this.runner.runInScope(
      { clientId: scope.clientId, organizationId: scope.organizationId },
      (snapshots) => operation(new PrismaScoredBifSnapshotRepository(snapshots)),
    );
  }
}
