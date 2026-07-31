import { defineConfig, mergeConfig } from 'vitest/config';

import { vitestBaseConfig } from '../../vitest.base.config';

/**
 * The DEFAULT test run for this package: database-free (ADR-0032 D13).
 *
 * `*.db.spec.ts` is excluded here and included only by `vitest.db.config.ts`,
 * so `pnpm test` — and therefore the pure CI job — never needs a `DATABASE_URL`
 * and never provisions PostgreSQL.
 */
export default mergeConfig(
  vitestBaseConfig,
  defineConfig({
    test: {
      include: ['src/**/*.{test,spec}.ts'],
      exclude: ['**/node_modules/**', '**/dist/**', 'src/**/*.db.spec.ts'],
    },
  }),
);
