import { fileURLToPath } from 'node:url';

import { defineConfig, mergeConfig } from 'vitest/config';

import { vitestBaseConfig } from '../../vitest.base.config';

/**
 * 🚫 `--passWithNoTests` is deliberately absent, for the reason ADR-0048 D4
 * gives: a green signal produced by the absence of tests is indistinguishable
 * from one produced by passing tests. If the glob below stops matching, this
 * app must go red.
 */
export default mergeConfig(
  vitestBaseConfig,
  defineConfig({
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
