import { defineConfig, mergeConfig } from 'vitest/config';

import { vitestBaseConfig } from '../../vitest.base.config';

/**
 * The LIVE PostgreSQL test run (ADR-0032 D11, D13). Invoked only by `test:db`,
 * never by `test`.
 *
 * These specs require a real database and are the only tests in the repository
 * that do. They do not skip when one is absent — they fail. A skipped test
 * reports as a pass, and a green suite that proved nothing is precisely the
 * failure ADR-0032 exists to prevent.
 *
 * `--passWithNoTests` is deliberately NOT set: if the include pattern ever stops
 * matching, this run must fail rather than quietly succeed.
 */
export default mergeConfig(
  vitestBaseConfig,
  defineConfig({
    test: {
      include: ['src/**/*.db.spec.ts'],
      // A live database is slower than a table double, and the first connection
      // in CI may wait on the service container's health check.
      testTimeout: 30_000,
      hookTimeout: 60_000,
      // One database, shared state: run the files serially so a truncate in one
      // cannot race a read in another.
      fileParallelism: false,
    },
  }),
);
