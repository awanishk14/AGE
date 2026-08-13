#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { runCli, type CaptureCliRuntime } from './capture-cli';

/**
 * The capture CLI's entry point (ADR-0043 D5, Slice B2).
 *
 * THIS MODULE OWNS EVERY IMPURE THING, AND NOTHING ELSE. `process.argv`, the
 * profile read — the first production `node:fs` read in this repository (D3) —
 * the clock, the id source, the two output streams and the exit code all live
 * here and nowhere else. It contains no branch on the operator's input, no
 * validation and no policy: all of that is in `capture-runner.ts`, which is a
 * pure function of its arguments and is tested as one.
 *
 * WHY THE PRISMA CHAIN IS IMPORTED LAZILY. `produceOnly` must not construct a
 * `PrismaClient`, and a static import would load `@prisma/client` — and fail on
 * an ungenerated client — before the run had even read its arguments. The
 * dynamic import means the safe mode of this CLI needs no database, no
 * credentials and no `prisma generate` at all.
 *
 * `process.exitCode` IS SET, `process.exit` IS NOT CALLED. `process.exit`
 * truncates pending stream writes, which on Windows can drop the final lines of
 * the very echo D4 relies on. Setting the code lets Node exit once the streams
 * have drained and the connection has been released.
 */

const runtime: CaptureCliRuntime = {
  readProfileText: (path: string): string => readFileSync(path, 'utf8'),
  readOperatorFileText: (path: string): string => readFileSync(path, 'utf8'),
  now: () => new Date(),
  newSnapshotId: () => randomUUID(),
  openCaptureOrchestrator: async () => {
    const { openPrismaCaptureConnection } = await import('./capture-composition');

    return openPrismaCaptureConnection();
  },
  /**
   * ADR-0054 D6 condition 2: the onboarding command's door refuses a target
   * that is not on this machine. A SEPARATE door from the one above, because
   * `age-capture` is also what `ci-db.yml` drives against its service container.
   */
  openLocalCaptureOrchestrator: async () => {
    const { openLocalPrismaCaptureConnection } = await import('./capture-composition');

    return openLocalPrismaCaptureConnection();
  },
  /**
   * ADR-0055 D2 — the read door. A THIRD door, and the narrow one: what comes
   * back carries two reads and a close, and no `append` for `inspect` to reach.
   * Lazy for the same reason as the two above — `produceOnly` must still need no
   * `@prisma/client` at all.
   */
  openSnapshotReadConnection: async () => {
    const { openLocalPrismaSnapshotReadConnection } = await import('./capture-composition');

    return openLocalPrismaSnapshotReadConnection();
  },
  /** ⚠️ AGE's identity for an observation. 🚫 Never the source's own id. */
  newObservationId: () => randomUUID(),
  /**
   * ADR-0069 D4 — the relay's read door. NARROWED HERE, on purpose: the relay
   * needs one question answered ("what does AGE model for this business?") and
   * gets exactly that operation, not the whole snapshot reader.
   */
  openRelayContextConnection: async () => {
    const { openLocalPrismaSnapshotReadConnection } = await import('./capture-composition');
    const connection = openLocalPrismaSnapshotReadConnection();

    return { findLatest: connection.findLatest, close: connection.close };
  },
  /**
   * ADR-0069 D3/D7 — the relay's write door, and the ONLY way an observation
   * reaches the store. A FIFTH door, separate from the read one above, so that
   * every path which must not write holds nothing that could.
   */
  openObservationAppendConnection: async () => {
    const { openLocalPrismaObservationAppendConnection } = await import('./capture-composition');

    return openLocalPrismaObservationAppendConnection();
  },
};

export async function main(argv: readonly string[]): Promise<number> {
  const result = await runCli(argv, runtime);

  for (const line of result.stdout) {
    process.stdout.write(`${line}\n`);
  }
  for (const line of result.stderr) {
    process.stderr.write(`${line}\n`);
  }

  return result.exitCode;
}

main(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    // An unexpected throw is not a capture failure and must not borrow its
    // code: `runCapture` reports every anticipated failure as a code, so
    // reaching here means something the CLI did not model went wrong.
    //
    // 🚫 THE STACK IS NOT PRINTED. A stack renders framed values, and the
    // frames reachable here hold the operator's connection string and the
    // client's serialized context. `openLocalCaptureOrchestrator` is called
    // outside `runOnboarding`'s try, so a driver initialisation failure lands
    // exactly here — which is why this is the wrong place for a default dump.
    process.stderr.write(`${error instanceof Error ? error.name : 'Unexpected failure'}\n`);
    process.exitCode = 1;
  });
