import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runAllCapabilities } from '@age/demo-runtime';

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
