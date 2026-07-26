import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEMO_SCENARIO_METADATA,
  runAllCapabilities,
  runBusinessDiscoveryIntake,
} from '@age/demo-runtime';

/**
 * The CLI app is now a thin shell over `@age/demo-runtime`. These tests assert
 * the app wires the shared runner correctly and stays side-effect-free; the
 * exhaustive runner behaviour is covered in `@age/demo-runtime`.
 */

/** Recursively collect every .ts file under a directory. */
function collectTsFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectTsFiles(full));
    } else if (entry.isFile() && extname(entry.name) === '.ts') {
      found.push(full);
    }
  }
  return found;
}

describe('AGE demo CLI app', () => {
  it('runs all six capabilities via the shared runtime', async () => {
    const reports = await runAllCapabilities();
    expect(reports).toHaveLength(6);
  });

  it('has exactly six decision objects pending human approval', async () => {
    const reports = await runAllCapabilities();
    const pending = reports.reduce((sum, r) => sum + r.acceptedItems.length, 0);
    expect(pending).toBe(6);
  });

  it('runs the upstream Business Discovery intake via the shared runtime', () => {
    const summary = runBusinessDiscoveryIntake(DEMO_SCENARIO_METADATA);
    expect(summary.profileSchemaValid).toBe(true);
    expect(summary.questionnaireValid).toBe(true);
    // Canonical Path B output: populated sections plus first-class omissions.
    expect(summary.presentSectionTypes.length).toBeGreaterThan(0);
    expect(summary.presentSectionTypes.length + summary.omittedSectionTypes.length).toBe(12);
  });

  it('passes the demo scenario metadata explicitly at the CLI call site', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, '..', 'run.ts'), 'utf8');
    expect(source).toMatch(/runBusinessDiscoveryIntake\(DEMO_SCENARIO_METADATA\)/);
  });

  it('keeps discovery out of the approval model (pending count unchanged)', async () => {
    runBusinessDiscoveryIntake(DEMO_SCENARIO_METADATA);
    const reports = await runAllCapabilities();
    const pending = reports.reduce((sum, r) => sum + r.acceptedItems.length, 0);
    expect(pending).toBe(6);
  });

  it('imports no side-effecting modules in the CLI shell (db, redis, http, queues, integrations)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const srcDir = join(here, '..');
    const thisFile = fileURLToPath(import.meta.url);
    const files = collectTsFiles(srcDir).filter((f) => f !== thisFile);

    const forbidden = [
      'prisma',
      '@age/persistence',
      '@age/integrations',
      'ioredis',
      "'redis'",
      'axios',
      'node:http',
      "from 'http'",
      'kafka',
    ];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const token of forbidden) {
        expect(content.includes(token), `${file} must not reference ${token}`).toBe(false);
      }
    }
  });
});
