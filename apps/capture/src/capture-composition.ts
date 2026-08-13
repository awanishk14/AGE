import { PrismaClient } from '@prisma/client';
import type { StoredSourceObservation } from '@age/source-observation';
import {
  PrismaSourceObservationScopeRunner,
  ScopedSourceObservationRepository,
} from '@age/source-observation-persistence';
import {
  PrismaScoredBifSnapshotScopeRunner,
  ScopedScoredBifSnapshotRepository,
  ScoredBifSnapshotCaptureOrchestrator,
} from '@age/scored-bif-snapshot-persistence';

import {
  resolveCaptureDatasourceUrl,
  type CaptureConnectionEnvironment,
} from './capture-connection-target';
import type { CaptureConnection } from './capture-runner';
import type { SnapshotReadConnection } from './inspect-runner';
import { assertLocalDatabaseTarget } from './local-database-target';

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
 * WHICH IDENTITY IT CONNECTS AS — ADR-0046 D4, closed in Slice 2. This used to
 * construct a bare `PrismaClient`, which resolves `DATABASE_URL`: repo-wide the
 * **owner** connection, for which the table's row-level policies do not apply
 * at all. The chain that exists to write correctly-scoped rows therefore
 * asserted nothing about the role it wrote them as. It now resolves
 * `DATABASE_URL_APP` — the non-owner application role — through the pure
 * `resolveCaptureDatasourceUrl`, and **throws before constructing a client** when
 * that is missing or is merely the owner connection under another name. There
 * is deliberately no fallback: a silent downgrade would remove the guard on
 * exactly the run that had lost it.
 *
 * NO CREDENTIALS ARE READ HERE BEYOND THAT ONE VARIABLE, and none is ever
 * logged, echoed or included in an error message — a connection string carries
 * a password. `datasourceUrl` exists only so the live test can point this very
 * same composition root at `age_app` explicitly (ADR-0043 D8).
 */
/**
 * Refuses the run rather than returning a usable-looking connection.
 *
 * A throw, not a returned outcome: the caller is the CLI's injected
 * `openCaptureOrchestrator`, and `main.ts` already maps an unmodelled throw to
 * exit code 1 with the message on stderr. Every *anticipated* operator mistake
 * is still a named exit code from `runCapture`; this one is a deployment
 * mistake that must stop the process before it can connect.
 */
const resolveConnectionUrl = (environment: CaptureConnectionEnvironment): string => {
  const resolved = resolveCaptureDatasourceUrl(environment);

  if (!resolved.ok) {
    throw new Error(
      `The capture CLI cannot open a database connection: ${resolved.errors.join(' ')}`,
    );
  }

  return resolved.url;
};

export interface CaptureConnectionOptions {
  /**
   * Overrides the resolved connection entirely.
   * Used by the live test to run this chain as `age_app`; unset in normal use.
   */
  readonly datasourceUrl?: string;
  /**
   * The environment to resolve `DATABASE_URL_APP` from. Injectable so the
   * resolution can be exercised without mutating the real process environment;
   * defaults to it.
   */
  readonly environment?: CaptureConnectionEnvironment;
}

export function openPrismaCaptureConnection(
  options: CaptureConnectionOptions = {},
): CaptureConnection {
  const url = options.datasourceUrl ?? resolveConnectionUrl(options.environment ?? process.env);

  const client = new PrismaClient({ datasources: { db: { url } } });

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

/**
 * The same chain, behind ADR-0054 D6 condition 2: the target must be a local
 * development database the operator controls, or the run refuses.
 *
 * ⚠️ A SEPARATE FUNCTION, NOT A FLAG ON THE ONE ABOVE. `age-capture` — and
 * `ci-db.yml`'s live migration test — drive `openPrismaCaptureConnection`
 * directly, and D6 is a permission for the onboarding command, not a new
 * restriction on everything that already existed. A shared function with an
 * `allowRemote` escape hatch would be the same rule with a documented way past
 * it.
 *
 * ⚠️ The assertion happens ABOVE `new PrismaClient(`. A check that ran after
 * the client was constructed would already have handed the connection string to
 * a driver that may dial on first use.
 */
export function openLocalPrismaCaptureConnection(
  options: CaptureConnectionOptions = {},
): CaptureConnection {
  const url = options.datasourceUrl ?? resolveConnectionUrl(options.environment ?? process.env);

  assertLocalDatabaseTarget(url);

  return openPrismaCaptureConnection({ ...options, datasourceUrl: url });
}

/**
 * The read half of the same chain, narrowed on the way out (ADR-0055 D2).
 *
 * ⚠️ IT RETURNS A FAÇADE, NOT THE REPOSITORY. `ScopedScoredBifSnapshotRepository`
 * implements the whole four-method port, `append` included. Handing it to a
 * command whose entire premise is that it cannot write would make the premise a
 * convention — true only for as long as nobody typed `.append(`. The two reads
 * are bound out individually and the repository itself never escapes this
 * function, so `inspect` holds no reference that could write.
 *
 * 🚫 `listSeries` IS NOT BOUND EITHER, and that is a separate refusal from the
 * one above. Cross-snapshot reading — a series listing, a diff, "what changed
 * since last capture" — is ADR-0055 §5 item 1: **recorded, NOT authorized**. It
 * needs its own `Proposed` ADR, and it would be one flag on this façade away
 * from existing, which is exactly why the flag is not here.
 *
 * ⚠️ LOCAL-ONLY, on the same reasoning as the writer above and for a reason that
 * survives the direction change: reading is not harmless. A remote target here
 * would pull a real client's stored business context onto whatever machine ran
 * the command. `assertLocalDatabaseTarget` therefore runs ABOVE
 * `new PrismaClient(` — and ⚠️ a loopback host remains NECESSARY, NOT
 * SUFFICIENT: an SSH tunnel from `localhost:5432` to a shared server passes it.
 *
 * ⚠️ IT CONNECTS AS `age_app`, the non-owner role, through the same
 * `resolveConnectionUrl` — so this read is subject to the row-level policies
 * rather than exempt from them. 🚫 That still does not make RLS an authorization
 * boundary (ADR-0046 D5, ADR-0055 D9): the policy checks the row against the
 * scope the transaction ASKED for, never against an entitlement to it. The
 * boundary here is that the scope came from the operator's client record.
 */
export function openLocalPrismaSnapshotReadConnection(
  options: CaptureConnectionOptions = {},
): SnapshotReadConnection {
  const url = options.datasourceUrl ?? resolveConnectionUrl(options.environment ?? process.env);

  assertLocalDatabaseTarget(url);

  const client = new PrismaClient({ datasources: { db: { url } } });

  const repository = new ScopedScoredBifSnapshotRepository(
    new PrismaScoredBifSnapshotScopeRunner(client),
  );

  return {
    findBySnapshotId: (key) => repository.findBySnapshotId(key),
    findLatest: (key) => repository.findLatest(key),
    close: () => client.$disconnect(),
  };
}

/**
 * The read half of the observation store, narrowed on the way out (ADR-0069
 * deliverable 6).
 *
 * ⚠️ **IT RETURNS A FAÇADE, NOT THE REPOSITORY.**
 * `ScopedSourceObservationRepository` carries `append` as well as the read.
 * Handing it to a screen whose entire premise is that it cannot write would
 * make the premise a convention — true only until somebody typed `.append(`.
 * The read is bound out individually and the repository never escapes this
 * function, so the Sources screen holds no reference that could relay an
 * observation. 🛑 The relay is a separate act, on a separate path.
 *
 * 🛑 **IT IS SCOPED, AND THAT IS NOT A DETAIL.** Under
 * `FORCE ROW LEVEL SECURITY` an unscoped `SELECT` does not fail — it returns
 * ZERO ROWS, which a screen would render as "no source system has relayed
 * anything". A missing scope must never be able to look like an honest empty
 * answer, so the read goes through the scope runner and never through a bare
 * delegate.
 *
 * ⚠️ LOCAL-ONLY, on the same reasoning as the snapshot read: reading is not
 * harmless — a remote target would pull a real business's relayed observations
 * onto whatever machine ran the console. `assertLocalDatabaseTarget` runs ABOVE
 * `new PrismaClient(`, and ⚠️ a loopback host stays NECESSARY, NOT SUFFICIENT.
 *
 * ⚠️ IT CONNECTS AS `age_app`, the non-owner role, so the read is subject to the
 * policies rather than exempt from them. 🚫 That still does not make RLS an
 * authorization boundary (ADR-0046 D5): the policy checks the row against the
 * scope the transaction ASKED for, never against an entitlement to it.
 */
export interface ObservationReadConnection {
  readonly listForOrganization: (
    organizationId: string,
  ) => Promise<ReadonlyArray<StoredSourceObservation>>;
  readonly close: () => Promise<void>;
}

export function openLocalPrismaObservationReadConnection(
  options: CaptureConnectionOptions = {},
): ObservationReadConnection {
  const url = options.datasourceUrl ?? resolveConnectionUrl(options.environment ?? process.env);

  assertLocalDatabaseTarget(url);

  const client = new PrismaClient({ datasources: { db: { url } } });

  const repository = new ScopedSourceObservationRepository(
    new PrismaSourceObservationScopeRunner(client),
  );

  return {
    listForOrganization: (organizationId) => repository.listForOrganization(organizationId),
    close: () => client.$disconnect(),
  };
}
