import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Recursively collect every .ts/.tsx file under a directory. */
function collectSourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectSourceFiles(full));
    } else if (entry.isFile() && ['.ts', '.tsx'].includes(extname(entry.name))) {
      found.push(full);
    }
  }
  return found;
}

const pageDir = join(__dirname);
const libFile = join(__dirname, '..', '..', 'lib', 'execution-audit.ts');
const files = [...collectSourceFiles(pageDir).filter((f) => f !== __filename), libFile];

describe('execution-audit web view (ADR-0022 Slice C, read-only)', () => {
  it('has a page.tsx route file', () => {
    expect(existsSync(join(pageDir, 'page.tsx'))).toBe(true);
  });

  it('has a read-only API client helper file', () => {
    expect(existsSync(libFile)).toBe(true);
  });

  it('only calls GET on the execution-audit API (no mutation fetch)', () => {
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      if (!content.includes('fetch(')) continue;
      // Every fetch() call in this module must be GET (explicit or default/omitted method).
      expect(content.includes("method: 'POST'")).toBe(false);
      expect(content.includes("method: 'PUT'")).toBe(false);
      expect(content.includes("method: 'PATCH'")).toBe(false);
      expect(content.includes("method: 'DELETE'")).toBe(false);
    }
  });

  it('does not reference any mutation/approval/execution route or endpoint', () => {
    const forbiddenTokens = [
      '/execute',
      '/approve',
      '/approval',
      "method: 'POST'",
      "method: 'PUT'",
      "method: 'PATCH'",
      "method: 'DELETE'",
    ];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const token of forbiddenTokens) {
        expect(content.includes(token), `${file} must not reference ${token}`).toBe(false);
      }
    }
  });

  it('does not contain approve/execute/retry/run button text or server action mutations', () => {
    const forbiddenButtonText = [
      '>Approve<',
      '>Execute<',
      '>Retry<',
      '>Run<',
      'approveExecution',
      'executeNow',
      'retryExecution',
      'runExecution',
      "'use server'",
      'formAction',
    ];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const token of forbiddenButtonText) {
        expect(content.includes(token), `${file} must not reference ${token}`).toBe(false);
      }
    }
  });

  it('displays mode: dry_run and sideEffectsPerformed: false labels', () => {
    const pageContent = readFileSync(join(pageDir, 'page.tsx'), 'utf8');
    expect(pageContent).toMatch(/Dry-run only/);
    expect(pageContent).toMatch(/side effects performed: false/i);
  });

  it('renders an explicit empty-state message when no records exist', () => {
    const pageContent = readFileSync(join(pageDir, 'page.tsx'), 'utf8');
    expect(pageContent).toContain('No dry-run audit records found for this scope.');
  });

  it('client helper only builds requests to GET /execution-audit routes', () => {
    const libContent = readFileSync(libFile, 'utf8');
    expect(libContent).toContain('/execution-audit');
    expect(libContent).toMatch(/method:\s*'GET'/);
    expect(libContent.includes("method: 'POST'")).toBe(false);
  });

  it('page and lib files import no persistence/DB/queue/integration modules', () => {
    const forbidden = [
      'prisma',
      '@prisma/client',
      '@age/persistence',
      '@age/integrations',
      'ioredis',
      "'redis'",
      'kafka',
      'bullmq',
    ];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const token of forbidden) {
        expect(content.includes(token), `${file} must not reference ${token}`).toBe(false);
      }
    }
  });
});
