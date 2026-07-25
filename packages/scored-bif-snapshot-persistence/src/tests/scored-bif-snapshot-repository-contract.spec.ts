import { InMemoryScoredBifSnapshotRepository } from '@age/business-discovery-contracts';
import { PrismaScoredBifSnapshotRepository } from '../prisma-scored-bif-snapshot-repository';
import { FakeScoredBifSnapshotDelegate } from './fake-scored-bif-snapshot-delegate';
import { describeScoredBifSnapshotRepositoryContract } from './scored-bif-snapshot-repository-contract';

/**
 * One contract, both adapters (ADR-0031 implementation constraints).
 *
 * The in-memory adapter is the reference implementation stage 2 delivered; the
 * durable adapter is stage 3a. Running the identical suite over both is what
 * makes "the storage changed, the contract did not" a checked claim rather than
 * an assertion in a commit message.
 *
 * WHAT THE DURABLE HALF RUNS AGAINST, STATED PLAINLY. There is no PostgreSQL in
 * this suite. CI has no database (no `services:` block, no `DATABASE_URL`), and
 * provisioning one is explicitly out of scope for this slice, so the durable
 * adapter is exercised against a table double that emulates the composite
 * primary key and `orderBy`/`take`. This is a contract-level test of the
 * adapter's query behaviour — NOT evidence that the DDL applies cleanly, that
 * the index is used, or that PostgreSQL's collation orders `capturedAt` the way
 * `localeCompare` does. Executing this suite against a live database is a named
 * follow-up, not a thing quietly assumed to have happened.
 */

describeScoredBifSnapshotRepositoryContract(
  'InMemoryScoredBifSnapshotRepository',
  () => new InMemoryScoredBifSnapshotRepository(),
);

describeScoredBifSnapshotRepositoryContract(
  'PrismaScoredBifSnapshotRepository (against a table double)',
  () => new PrismaScoredBifSnapshotRepository(new FakeScoredBifSnapshotDelegate()),
);
