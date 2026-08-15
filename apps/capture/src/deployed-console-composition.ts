import { PrismaClient } from '@prisma/client';
import {
  selectDeployedDatabaseComposition,
  type DeployedDatabaseComposition,
  type RemoteAcknowledgement,
} from '@age/deployed-database-target';
import {
  PrismaSourceObservationScopeRunner,
  ScopedSourceObservationRepository,
} from '@age/source-observation-persistence';
import {
  PrismaScoredBifSnapshotScopeRunner,
  ScopedScoredBifSnapshotRepository,
} from '@age/scored-bif-snapshot-persistence';

import {
  resolveCaptureDatasourceUrl,
  type CaptureConnectionEnvironment,
} from './capture-connection-target';
import type { ObservationReadConnection } from './capture-composition';
import type { SnapshotReadConnection } from './inspect-runner';

/**
 * The **deployed** composition root — ADR-0061 **A5**, wired for the first time
 * by ADR-0074 §7 slice 1.
 *
 * 🛑 **THE CONSEQUENCE BEFORE THE MECHANISM.** These doors open a database on a
 * server the operator does not physically hold. That is a genuine reduction in
 * safety, the Product Owner made the call knowing the product carries their
 * clients' data, and 🚫 nothing here may be read as saying otherwise.
 *
 * ⚠️ **WHY IT IS A SECOND FILE AND NOT A FLAG.** `capture-composition.ts`'s
 * doors assert `assertLocalDatabaseTarget`, whose meaning is *"this database is
 * on the machine you are sitting at"*. On a VPS that sentence is false even
 * though the check still passes, because a loopback address on a server is
 * loopback **on the server**. A5 refuses an `allowRemote` parameter by name —
 * _"the copy that gets relaxed still passes its own tests"_ — so the honest
 * arrangement is two names: the local one keeps its claim, and this one makes a
 * different, weaker, TRUE claim. 🚫 Do not add a parameter to either that turns
 * it into the other.
 *
 * 🛑 **THERE ARE EXACTLY TWO DOORS AND BOTH ONLY READ.** There is deliberately
 * no deployed capture door and no deployed observation APPEND door. Nothing has
 * authorized a deployed AGE to WRITE a client's rows, and the way that stays
 * true is that the function which would do it does not exist here — not that a
 * caller declines to call it. 🚫 Do not add one without its own ADR.
 *
 * 🚫 **THIS IS NOT AN AUTHORIZATION** (ADR-0046 D5, ADR-0055 D9). Where a row
 * may be stored is not who may read it. These doors connect as the non-owner
 * `age_app` role, so the reads are subject to the row-level policies rather than
 * exempt from them — but RLS is COHERENCE, and 🚫 the isolation ADR-0074 owes is
 * never proven by it and never by an empty result set.
 *
 * ⚠️ **THE ACKNOWLEDGEMENT IS WRITTEN OUT BY THE CALLER, IN SOURCE.** Its
 * literal type cannot be satisfied by a `string | undefined` read out of an
 * environment, so the choice to run against a server the operator does not hold
 * is made in code somebody reviewed. That is A5's mechanism, not ceremony.
 *
 * ⚠️ **THE JUDGEMENT RUNS ABOVE `new PrismaClient(`.** A check performed after
 * the client was constructed would already have handed the connection string to
 * a driver that may dial on first use.
 */

/** What every door here needs. 🚫 There is no defaulted, unacknowledged form. */
export interface DeployedConnectionOptions {
  /**
   * 🛑 Written out in source by whoever chose the deployed composition. Required
   * on every door — 🚫 it is not optional and 🚫 it has no default.
   */
  readonly acknowledgedRemote: RemoteAcknowledgement;
  /**
   * Overrides the resolved connection entirely. Used by the live test to point
   * this same composition root at `age_app` explicitly; unset in normal use.
   */
  readonly datasourceUrl?: string;
  /**
   * The environment to resolve `DATABASE_URL_APP` from. Injectable so the
   * resolution can be exercised without mutating the real process environment.
   */
  readonly environment?: CaptureConnectionEnvironment;
}

/**
 * Resolves `DATABASE_URL_APP` and judges it against A5, or refuses the run.
 *
 * ⚠️ A throw, not an outcome: a deployment that cannot establish which database
 * it may talk to must stop, at start-up, while somebody is watching.
 *
 * ⚠️ NO CREDENTIAL IS EVER RETURNED IN AN ERROR. The underlying refusals name a
 * VARIABLE or a HOST and nothing else; a connection string carries a password.
 */
function judge(options: DeployedConnectionOptions): DeployedDatabaseComposition {
  const resolved =
    options.datasourceUrl === undefined
      ? resolveCaptureDatasourceUrl(options.environment ?? process.env)
      : ({ ok: true, url: options.datasourceUrl } as const);

  if (!resolved.ok) {
    throw new Error(
      `The deployed console cannot open a database connection: ${resolved.errors.join(' ')}`,
    );
  }

  return selectDeployedDatabaseComposition({
    url: resolved.url,
    acknowledgedRemote: options.acknowledgedRemote,
  });
}

/**
 * The snapshot READ door, narrowed on the way out exactly as its local
 * counterpart is (ADR-0055 D2).
 *
 * 🚫 `append` is not bound, so the console holds no reference that could write.
 * 🚫 `findBySnapshotId` is not bound either, and that is a SEPARATE refusal:
 * addressing a snapshot by id is how a surface begins comparing two of them, and
 * cross-snapshot reading is ADR-0055 §5 item 1 — recorded, NOT authorized.
 */
export function openDeployedPrismaSnapshotReadConnection(
  options: DeployedConnectionOptions,
): SnapshotReadConnection {
  const composition = judge(options);

  const client = new PrismaClient({ datasources: { db: { url: composition.url } } });

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
 * The observation READ door (ADR-0069 deliverable 6), narrowed the same way.
 *
 * 🛑 **IT IS SCOPED, AND THAT IS NOT A DETAIL.** Under
 * `FORCE ROW LEVEL SECURITY` an unscoped `SELECT` does not fail — it returns
 * ZERO ROWS, which a screen would render as "no source system has relayed
 * anything". A missing scope must never be able to look like an honest empty
 * answer, so the read goes through the scope runner and never a bare delegate.
 *
 * 🚫 `append` is not bound. The relay is a separate act on a separate path, and
 * it does not become reachable by being adjacent to this one.
 */
export function openDeployedPrismaObservationReadConnection(
  options: DeployedConnectionOptions,
): ObservationReadConnection {
  const composition = judge(options);

  const client = new PrismaClient({ datasources: { db: { url: composition.url } } });

  const repository = new ScopedSourceObservationRepository(
    new PrismaSourceObservationScopeRunner(client),
  );

  return {
    listForOrganization: (organizationId) => repository.listForOrganization(organizationId),
    close: () => client.$disconnect(),
  };
}
