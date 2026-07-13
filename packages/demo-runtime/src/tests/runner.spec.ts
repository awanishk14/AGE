import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runAllCapabilities } from '../capabilities';

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

const EXPECTED_NAMES = [
  'Intelligence',
  'Market Discovery',
  'Growth',
  'Authority',
  'Operations',
  'Revenue',
];

// Each fixture supplies exactly 1 valid + 1 invalid + 1 duplicate item.
const EXPECTED_DISPOSITION = { accepted: 1, rejected: 1, duplicate: 1, derived: 3 };

describe('AGE capability demo runner', () => {
  it('runs all six capabilities and returns a report for each', async () => {
    const reports = await runAllCapabilities();
    expect(reports).toHaveLength(6);
    expect(reports.map((r) => r.name)).toEqual(EXPECTED_NAMES);
  });

  it('produces the expected accepted/rejected/duplicate disposition for every capability', async () => {
    const reports = await runAllCapabilities();
    for (const report of reports) {
      expect(
        {
          accepted: report.acceptedCount,
          rejected: report.rejectedCount,
          duplicate: report.duplicateCount,
          derived: report.derivedCount,
        },
        `disposition for ${report.name}`,
      ).toEqual(EXPECTED_DISPOSITION);
    }
  });

  it('holds the accounting invariant (accepted + rejected + duplicate === derived === input items)', async () => {
    const reports = await runAllCapabilities();
    for (const report of reports) {
      expect(report.accountingHolds, `accounting for ${report.name}`).toBe(true);
      expect(report.derivedCount).toBe(report.inputItemCount);
      expect(report.acceptedItems).toHaveLength(report.acceptedCount);
    }
  });

  it('surfaces exactly one rejected reason and one duplicate reference per capability', async () => {
    const reports = await runAllCapabilities();
    for (const report of reports) {
      expect(report.rejectedReasons, `rejected reasons for ${report.name}`).toHaveLength(1);
      expect(report.duplicateReferences, `duplicate refs for ${report.name}`).toHaveLength(1);
    }
  });

  it('reports the Intelligence-specific contradictionCount as an extra counter', async () => {
    const reports = await runAllCapabilities();
    const intelligence = reports.find((r) => r.name === 'Intelligence');
    expect(intelligence?.extra?.contradictionCount).toBe(0);
  });

  it('is deterministic across runs for the accounting-relevant view (producedAt excluded)', async () => {
    const view = (reports: Awaited<ReturnType<typeof runAllCapabilities>>) =>
      reports.map((r) => ({
        name: r.name,
        accepted: r.acceptedCount,
        rejected: r.rejectedCount,
        duplicate: r.duplicateCount,
        acceptedIds: r.acceptedItems.map((i) => i.id),
      }));
    const a = await runAllCapabilities();
    const b = await runAllCapabilities();
    expect(view(a)).toEqual(view(b));
  });

  it('imports no side-effecting modules across ALL demo source (db, redis, http, queues, integrations)', () => {
    // Static guard over every .ts file under src (excluding this spec, which
    // legitimately contains the forbidden token strings for the assertion).
    const here = dirname(fileURLToPath(import.meta.url));
    const srcDir = join(here, '..');
    const thisFile = fileURLToPath(import.meta.url);
    const files = collectTsFiles(srcDir).filter((f) => f !== thisFile);

    // Sanity: the guard must actually cover the fixtures + runner, not an empty set.
    expect(files.length).toBeGreaterThanOrEqual(9);

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
