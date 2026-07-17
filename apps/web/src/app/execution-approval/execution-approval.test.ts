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
const libFile = join(__dirname, '..', '..', 'lib', 'execution-approval.ts');
const files = [...collectSourceFiles(pageDir).filter((f) => f !== __filename), libFile];

describe('execution-approval web view (ADR-0023 Slice D3, dry-run approval only)', () => {
  it('has a page.tsx route file', () => {
    expect(existsSync(join(pageDir, 'page.tsx'))).toBe(true);
  });

  it('has an API client helper file', () => {
    expect(existsSync(libFile)).toBe(true);
  });

  it('only calls fetch against the execution-approval API routes', () => {
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      if (!content.includes('fetch(')) continue;
      expect(content.includes('/execution-approval')).toBe(true);
    }
  });

  it('mutation calls use POST only, never PUT/PATCH/DELETE', () => {
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content.includes("method: 'PUT'")).toBe(false);
      expect(content.includes("method: 'PATCH'")).toBe(false);
      expect(content.includes("method: 'DELETE'")).toBe(false);
    }
  });

  it('status read helper issues a GET request', () => {
    const libContent = readFileSync(libFile, 'utf8');
    expect(libContent).toMatch(/method:\s*'GET'/);
  });

  it('approve/reject helpers issue POST requests to the correct routes only', () => {
    const libContent = readFileSync(libFile, 'utf8');
    expect(libContent).toContain('/approve');
    expect(libContent).toContain('/reject');
    expect(libContent).toMatch(/method:\s*'POST'/);
  });

  it('does not reference any execute/run/schedule route or endpoint', () => {
    const forbiddenTokens = [
      '/execute',
      '/schedule',
      '/queue',
      '/worker',
      'executeNow',
      'runExecution',
      'retryExecution',
      'scheduleExecution',
      'approveAndExecute',
    ];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const token of forbiddenTokens) {
        expect(content.includes(token), `${file} must not reference ${token}`).toBe(false);
      }
    }
  });

  it('does not contain execute/run/approve-and-execute button text or server action mutations', () => {
    const forbiddenButtonText = [
      '>Execute<',
      '>Run<',
      '>Retry<',
      '>Approve and execute<',
      '>Approve &amp; execute<',
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

  it('page requires executionId, operatorId, organizationId, and clientId before submit is enabled', () => {
    const pageContent = readFileSync(join(pageDir, 'page.tsx'), 'utf8');
    expect(pageContent).toMatch(
      /canSubmit\s*=\s*Boolean\(executionId\s*&&\s*operatorId\s*&&\s*organizationId\s*&&\s*clientId\)/,
    );
    expect(pageContent).toContain('disabled={!canSubmit');
  });

  it('displays dry-run/no-op-only warning language', () => {
    const pageContent = readFileSync(join(pageDir, 'page.tsx'), 'utf8');
    expect(pageContent).toMatch(/dry-run/i);
    expect(pageContent).toMatch(/does not execute anything/i);
    expect(pageContent).toMatch(/does not authorize real execution/i);
  });

  it('renders an explicit empty-state message when no decision history exists', () => {
    const pageContent = readFileSync(join(pageDir, 'page.tsx'), 'utf8');
    expect(pageContent).toContain('No approval decisions recorded yet for this execution.');
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
