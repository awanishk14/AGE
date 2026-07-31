import { defineConfig } from 'vitest/config';

/**
 * The SHARED vitest base config. Every `vitest*.config.ts` in the repository
 * merges this, and a guard test asserts that none stops doing so.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS: the suite was fast, not bounded.
 *
 * Measured on a 16-core / 15.3 GB development machine before this file existed:
 * a single `pnpm test` peaked at **93 node processes** and ~**8,900 MB** across
 * the test processes, with a **2,298 MB** peak single worker. Added to ~4,791 MB
 * of ambient processes that is ~**90% of system memory**.
 *
 * Nothing was capping it. No `pool`, `maxWorkers`, `maxThreads` or `maxForks`
 * setting existed in any of the repository's vitest configs, so each vitest
 * process defaulted to one worker per core (16), and Nx ran up to
 * `parallel: 5` of those at once — a ceiling of ~80 workers that the suite
 * merely never had time to reach. It survived because the packages are small
 * and finish quickly, NOT because anything bounded it. A single slow package
 * would have held its 16 workers alive while four others spawned theirs.
 *
 * ⚠️ THE CAP IS ON WORKER COUNT, DELIBERATELY NOT ON HEAP SIZE.
 *
 * The obvious-looking companion change — an `execArgv` of
 * `--max-old-space-size=<n>` per worker — is NOT made here, and must not be
 * added without measuring first. The measured peak single worker in this
 * repository is **2,298 MB**, so any ceiling near the values that look
 * reasonable would abort the run instead of bounding it. A heap ceiling below
 * real demand does not make a suite lighter; it makes it fail having run zero
 * tests, which reports as a broken build rather than as the memory problem it
 * actually is.
 *
 * Bounding the number of concurrent workers is the honest fix: it is a hard
 * limit, it cannot OOM a test that previously passed, and it leaves each worker
 * the headroom it genuinely needs.
 */
export const vitestBaseConfig = defineConfig({
  test: {
    globals: true,
    environment: 'node',

    // Stated explicitly rather than inherited. `poolOptions` below is keyed BY
    // POOL NAME, so a future vitest changing its default pool would silently
    // strip the cap while leaving this file looking as though it still applied.
    pool: 'forks',

    poolOptions: {
      forks: {
        // ⚠️ Do not raise this to "use the machine". It is multiplied by Nx's
        // own `parallel` in nx.json — the two numbers compose, and the product
        // is what the machine actually sees.
        maxForks: 2,
        minForks: 1,
      },
    },

    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});

export default vitestBaseConfig;
