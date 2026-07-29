import { PrismaClient } from '@prisma/client';
import {
  PrismaScoredBifSnapshotScopeRunner,
  ScopedScoredBifSnapshotRepository,
  ScoredBifSnapshotCaptureOrchestrator,
} from '@age/scored-bif-snapshot-persistence';

import type { CaptureConnection } from './capture-runner';

/**
 * The composition root for the capture CLI — the ADR-0043 D6 chain, assembled
 * in one place (Slice B2).
 *
 * THIS IS THE ONLY MODULE IN THE REPOSITORY THAT CONSTRUCTS A `PrismaClient` IN
 * PRODUCTION CODE. Everything below it takes its collaborator as a constructor
 * parameter, which is why `@age/scored-bif-snapshot-persistence` stays free of
 * `@prisma/client` and free of `prisma generate` (PR #151). The dependency
 * arrives here, at the top, where an app is entitled to have one.
 *
 * THE CHAIN, AND WHY EVERY LINK IS REQUIRED:
 *
 *   PrismaClient
 *     → PrismaScoredBifSnapshotScopeRunner    sets the ADR-0033 transaction-local
 *                                             GUCs `age.client_id` /
 *                                             `age.organization_id`
 *     → ScopedScoredBifSnapshotRepository     the ONLY repository implementation
 *                                             that establishes that scope
 *     → ScoredBifSnapshotCaptureOrchestrator  ADR-0036; constructs the bound
 *                                             facade, returns an outcome, never
 *                                             throws
 *
 * The draft ADR-0043 D6 chain omitted the scope runner. Under
 * `FORCE ROW LEVEL SECURITY` the policies require both settings and `NULLIF(…)`
 * of a missing one is NULL — which is not TRUE — so every INSERT as the
 * non-owner `age_app` role would have been refused. The runner is not an
 * optimisation; without it this CLI cannot write at all.
 *
 * NO CREDENTIALS ARE READ HERE. `PrismaClient` resolves `DATABASE_URL` from the
 * environment through the schema's `datasource` block, exactly as every other
 * consumer in this repository does, and `datasourceUrl` exists only so the live
 * test can point the very same composition root at the non-owner role
 * (ADR-0043 D8). No connection string is ever logged or echoed.
 */
export interface CaptureConnectionOptions {
  /**
   * Overrides the connection the schema's `datasource` block would resolve.
   * Used by the live test to run this chain as `age_app`; unset in normal use.
   */
  readonly datasourceUrl?: string;
}

export function openPrismaCaptureConnection(
  options: CaptureConnectionOptions = {},
): CaptureConnection {
  const client =
    options.datasourceUrl === undefined
      ? new PrismaClient()
      : new PrismaClient({ datasources: { db: { url: options.datasourceUrl } } });

  // No cast. A generated `PrismaClient` satisfies the runner's structural
  // transaction source outright; if Prisma's shape ever drifts, this line stops
  // compiling rather than failing at runtime against a real database.
  const repository = new ScopedScoredBifSnapshotRepository(
    new PrismaScoredBifSnapshotScopeRunner(client),
  );

  return {
    orchestrator: new ScoredBifSnapshotCaptureOrchestrator(repository),
    close: () => client.$disconnect(),
  };
}
