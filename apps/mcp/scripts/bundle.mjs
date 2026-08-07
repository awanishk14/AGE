#!/usr/bin/env node
// Drives webpack through its Node API, so this app's bundle needs no
// `webpack-cli` dependency. See `webpack.config.cjs` for why a bundle is the
// only thing that can make `bin` executable at all.
//
// Fails loudly: a bundle that "succeeded" with errors would be published as a
// working `bin`.
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const webpack = require('webpack');
const config = require('../webpack.config.cjs');

const ENTRY_FILE = 'age-mcp.cjs';

/**
 * 🛑 THE TWO REFUSALS THAT ARE PROPERTIES OF THE SHIPPED ARTEFACT, NOT OF THE
 * SOURCE — so the build asserts them rather than trusting a source-level guard.
 *
 * A source guard scans the files it knows about. A bundle is what actually runs,
 * and it also contains everything the source pulled in transitively: a
 * dependency that grew a listener, or an `@age/*` package that grew a Prisma
 * construction, would be inside the artefact while every source guard in this
 * app kept passing.
 *
 * ⚠️ `.listen(` covers the shape of every Node listener worth catching —
 * `server.listen(...)`, `app.listen(...)` — without matching the many innocent
 * uses of the word "listen" in a comment or a description string.
 */
const FORBIDDEN = [
  {
    token: 'new PrismaClient(',
    why: 'the MCP surface has no database (ADR-0060 D6): no exemption to ADR-0055 D6 exists, and a persistence path reaching this bundle is one that bypassed assertLocalDatabaseTarget.',
  },
  {
    token: '.listen(',
    why: 'this server binds NOTHING (ADR-0060 D8 item 2). A server that listens admits a second party, and a caller-asserted OperatorPrincipal then becomes a caller granting itself access by naming itself — which is ADR-0061’s problem, and ADR-0061 is Proposed.',
  },
];

function assertBundleRefusals(outputPath) {
  const emitted = readdirSync(outputPath).filter((name) => name.endsWith('.cjs'));

  const entry = emitted.find((name) => name === ENTRY_FILE);
  if (!entry) {
    return [`the bundle emitted no ${ENTRY_FILE}`];
  }

  const errors = [];
  let examined = 0;

  for (const name of emitted) {
    const source = readFileSync(join(outputPath, name), 'utf8');
    examined += 1;

    for (const { token, why } of FORBIDDEN) {
      if (source.includes(token)) {
        errors.push(`${name} contains ${token}: ${why}`);
      }
    }
  }

  // ⚠️ The guard-test rule applied to the build: a scan that examined nothing
  // must never be reported as compliance.
  if (examined === 0) {
    errors.push('no emitted bundle was examined, so this build proved nothing');
  }

  // ⚠️ And a positive assertion, so the scan above is about something real: the
  // tool surface must actually BE in the artefact. Absence of the forbidden
  // tokens is equally satisfied by a bundle that dropped AGE entirely.
  if (!readFileSync(join(outputPath, entry), 'utf8').includes('age_list_businesses')) {
    errors.push(`${ENTRY_FILE} names no AGE tool: the tool surface is missing from the bundle.`);
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

  const errors = assertBundleRefusals(config.output.path);
  if (errors.length > 0) {
    for (const error of errors) {
      process.stderr.write(`bundle assertion failed: ${error}\n`);
    }
    process.exitCode = 1;
  }
});
