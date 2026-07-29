#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { runCapture, type CaptureRuntime } from './capture-runner';

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

const runtime: CaptureRuntime = {
  readProfileText: (path: string): string => readFileSync(path, 'utf8'),
  now: () => new Date(),
  newSnapshotId: () => randomUUID(),
  openCaptureOrchestrator: async () => {
    const { openPrismaCaptureConnection } = await import('./capture-composition');

    return openPrismaCaptureConnection();
  },
};

export async function main(argv: readonly string[]): Promise<number> {
  const result = await runCapture(argv, runtime);

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
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
