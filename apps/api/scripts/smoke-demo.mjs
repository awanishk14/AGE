#!/usr/bin/env node
/**
 * API demo runtime smoke check.
 *
 * Proves the *compiled* NestJS API can actually boot and serve
 * `GET /demo/capabilities`. This catches the exact class of regression where
 * `nest build` succeeds but the real server fails to boot at runtime (e.g. an
 * unresolvable workspace-package import that only surfaces when Node executes
 * the bundle).
 *
 * It spawns `node dist/main.js` on a non-default port, waits for the endpoint,
 * validates the response shape, and always shuts the spawned process down.
 *
 * Requires a prior build:  pnpm --filter @age/api build
 * Usage:                    node scripts/smoke-demo.mjs   (from apps/api)
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const entry = join(apiRoot, 'dist', 'main.js');
const port = Number(process.env.SMOKE_API_PORT ?? 4010);
const baseUrl = `http://localhost:${port}`;
const bootTimeoutMs = 30_000;
const pollIntervalMs = 500;

function fail(message) {
  console.error(`\n[smoke] FAIL: ${message}\n`);
  process.exitCode = 1;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Terminate the spawned API cleanly (SIGTERM, then SIGKILL as a backstop). */
function shutdown(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    const kill = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        /* already gone */
      }
      resolve();
    }, 5_000);
    child.once('exit', () => {
      clearTimeout(kill);
      resolve();
    });
    try {
      child.kill('SIGTERM');
    } catch {
      clearTimeout(kill);
      resolve();
    }
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function validate(body) {
  assert(Array.isArray(body.reports), 'response has no `reports` array');
  assert(body.reports.length === 6, `expected 6 reports, got ${body.reports.length}`);
  assert(
    body.summary?.capabilitiesRun === 6,
    `expected summary.capabilitiesRun === 6, got ${body.summary?.capabilitiesRun}`,
  );
  assert(
    body.summary?.totalPendingApprovals === 6,
    `expected summary.totalPendingApprovals === 6, got ${body.summary?.totalPendingApprovals}`,
  );
  assert(
    body.summary?.accountingInvariantHolds === true,
    'expected summary.accountingInvariantHolds === true',
  );
  assert(body.sideEffectsPerformed === false, 'expected sideEffectsPerformed === false');
  assert(!('executionResult' in body), 'response must not contain an `executionResult` field');
  for (const report of body.reports) {
    assert(
      !('executionResult' in report),
      `report "${report.capability}" must not contain an executionResult field`,
    );
  }

  // The upstream intake travels over the wire as context, never as a capability.
  const discovery = body.businessDiscovery;
  assert(discovery !== undefined, 'response has no `businessDiscovery` block');
  assert(
    discovery.presentSectionTypes?.length === 7 && discovery.omittedSectionTypes?.length === 5,
    `expected 7 populated / 5 omitted sections, got ${discovery.presentSectionTypes?.length} / ${discovery.omittedSectionTypes?.length}`,
  );
  assert(discovery.bifStatus === 'Draft', `expected bifStatus "Draft", got ${discovery.bifStatus}`);
  assert(
    !('pendingApproval' in discovery),
    'businessDiscovery must never enter the approval model',
  );
  // Both score pairs must survive serialization — reporting only the intake
  // pair would overstate what the produced Draft BIF actually contains.
  for (const field of [
    'discoveryCompletenessScore',
    'discoveryConfidenceScore',
    'bifCompletenessScore',
    'bifConfidenceScore',
  ]) {
    assert(
      typeof discovery[field] === 'number',
      `businessDiscovery.${field} must be a number, got ${typeof discovery[field]}`,
    );
  }
}

async function main() {
  if (!existsSync(entry)) {
    fail(`compiled API not found at ${entry}. Run: pnpm --filter @age/api build`);
    return;
  }

  console.log(`[smoke] starting compiled API on port ${port}…`);
  const child = spawn(process.execPath, [entry], {
    cwd: apiRoot,
    env: { ...process.env, API_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let apiStderr = '';
  child.stderr.on('data', (chunk) => {
    apiStderr += chunk.toString();
  });
  child.once('exit', (code) => {
    if (code && code !== 0 && process.exitCode !== 1) {
      fail(`API process exited early with code ${code}\n${apiStderr}`);
    }
  });

  try {
    const deadline = Date.now() + bootTimeoutMs;
    let lastError = 'timed out';
    let body;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error(`API exited before serving (code ${child.exitCode})\n${apiStderr}`);
      }
      try {
        const response = await fetch(`${baseUrl}/demo/capabilities`, {
          headers: { accept: 'application/json' },
        });
        assert(response.status === 200, `expected HTTP 200, got ${response.status}`);
        body = await response.json();
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        await sleep(pollIntervalMs);
      }
    }

    if (body === undefined) {
      throw new Error(`API never served ${baseUrl}/demo/capabilities (${lastError})`);
    }

    validate(body);
    console.log(
      `[smoke] OK: 6 capabilities, ${body.summary.totalPendingApprovals} pending approvals, ` +
        `accounting invariant ${body.summary.accountingInvariantHolds}, no side effects.`,
    );
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  } finally {
    await shutdown(child);
  }
}

await main();
