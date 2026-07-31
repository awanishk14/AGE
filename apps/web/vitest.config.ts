import { fileURLToPath } from 'node:url';

import { defineConfig, mergeConfig } from 'vitest/config';

import { vitestBaseConfig } from '../../vitest.base.config';

/**
 * ⚠️ Before ADR-0048 D4 this config was aspirational rather than effective.
 *
 * It named `environment: 'jsdom'` while `jsdom` appeared in no `package.json`
 * in the repository, and the package's `test` script carried
 * `--passWithNoTests` over an `include` glob matching zero files. The package
 * reported success on every CI run without ever loading the environment it
 * declares. That is the failure mode D4 names: a green signal produced by the
 * absence of tests is indistinguishable from one produced by passing tests.
 *
 * `--passWithNoTests` is deliberately NOT restored. If the glob below stops
 * matching, this package must go red.
 */
export default mergeConfig(
  vitestBaseConfig,
  defineConfig({
    // Next resolves `@/*` through tsconfig `paths`; vitest does not read them,
    // so the alias is restated here. Without it the page under test cannot
    // import its own data module.
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },

    // The app's tsconfig sets `jsx: preserve` for the Next compiler, which
    // leaves JSX untransformed for vitest. Transform it here rather than
    // weakening the app's build configuration to suit the test runner.
    esbuild: {
      jsx: 'automatic',
      jsxImportSource: 'react',
    },

    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }),
);
