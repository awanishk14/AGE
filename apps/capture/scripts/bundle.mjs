#!/usr/bin/env node
// Drives webpack through its Node API, so the CLI's bundle needs no
// `webpack-cli` dependency. See `webpack.config.cjs` for why a bundle is the
// only thing that can make `bin` executable at all.
//
// Fails loudly: a bundle that "succeeded" with errors would be published as a
// working `bin`, which is precisely the failure this slice exists to end.
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const webpack = require('webpack');
const config = require('../webpack.config.cjs');

const ENTRY_FILE = 'age-capture.cjs';
const PRISMA_CONSTRUCTION = 'new PrismaClient(';

/**
 * The split point is a safety property, not an optimisation, so the build
 * asserts it rather than trusting it.
 *
 * `produceOnly` must construct no `PrismaClient` and must need no generated
 * client (ADR-0043 D6, ADR-0046 D7). That holds only while `main.ts`'s
 * `await import('./capture-composition')` stays a genuine lazy chunk. Nothing
 * about that is visible in a passing build: replace the dynamic import with a
 * static one, or let a future webpack default inline small chunks, and the
 * bundle still builds, still runs, and quietly loads Prisma on every run.
 *
 * Both directions are checked. Absence from the entry bundle alone would also
 * be satisfied by a build that dropped the capture path entirely.
 */
function assertCompositionRootIsLazy(outputPath) {
  const emitted = readdirSync(outputPath).filter((name) => name.endsWith('.cjs'));
  const read = (name) => readFileSync(join(outputPath, name), 'utf8');

  const entry = emitted.find((name) => name === ENTRY_FILE);
  if (!entry) {
    return [`the bundle emitted no ${ENTRY_FILE}`];
  }

  const chunks = emitted.filter((name) => name !== ENTRY_FILE);
  const errors = [];

  if (read(entry).includes(PRISMA_CONSTRUCTION)) {
    errors.push(
      `${ENTRY_FILE} contains ${PRISMA_CONSTRUCTION}: the composition root was inlined into the entry bundle, so produceOnly would load @prisma/client.`,
    );
  }

  if (!chunks.some((name) => read(name).includes(PRISMA_CONSTRUCTION))) {
    errors.push(
      `no lazily loaded chunk contains ${PRISMA_CONSTRUCTION}: the capture path is missing from the bundle entirely.`,
    );
  }

  return errors;
}

webpack(config, (fatal, stats) => {
  if (fatal) {
    process.stderr.write(`${fatal.stack ?? String(fatal)}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`${stats.toString({ colors: false, chunks: false, modules: false })}\n`);

  if (stats.hasErrors()) {
    process.exitCode = 1;
    return;
  }

  const errors = assertCompositionRootIsLazy(config.output.path);
  if (errors.length > 0) {
    for (const error of errors) {
      process.stderr.write(`bundle assertion failed: ${error}\n`);
    }
    process.exitCode = 1;
  }
});
