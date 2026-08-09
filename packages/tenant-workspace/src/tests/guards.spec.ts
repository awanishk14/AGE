import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * ⚠️ Guard-test pattern (repo conventions): the walk asserts it found files
 * first, and comments are stripped before scanning — this module explains at
 * length why it touches no filesystem, and a guard that fails on its own
 * explanation gets deleted rather than fixed.
 */

const SRC = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (entry === 'node_modules' || entry === 'dist') return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') && !full.endsWith('.spec.ts') ? [full] : [];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const FILES = sourceFiles(SRC);

describe('@age/tenant-workspace decides about strings only', () => {
  it('found source files to scan', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(2);
  });

  it.each([
    'node:fs',
    'node:path',
    'fetch(',
    'new Date(',
    'Date.now(',
    'Math.random(',
    'process.env',
    'process.cwd',
    'mkdir',
    'readFile',
    'writeFile',
    'existsSync',
  ])('contains no %s', (token) => {
    let examined = 0;
    for (const file of FILES) {
      examined += 1;
      expect(stripComments(readFileSync(file, 'utf8')), file).not.toContain(token);
    }
    expect(examined).toBe(FILES.length);
  });
});

describe('the tenant root cannot be spelled by a caller (ADR-0061 A4)', () => {
  const source = stripComments(readFileSync(join(SRC, 'tenant-workspace-root.ts'), 'utf8'));

  it('takes the organization only as an unforgeable type', () => {
    // 🚫 A `string` parameter here would accept a URL segment, and a
    // user-supplied path segment is a traversal into another tenant's files.
    // ⚠️ The PUBLIC option is what a caller can reach. The private helper that
    // validates the segment legitimately takes a string — it is the thing doing
    // the checking, and it is reached only through the branded option.
    expect(source).toContain('readonly organizationId: AuthenticatedOrganizationId');
    expect(source).not.toMatch(/readonly\s+organizationId\s*:\s*string/);
  });

  it('casts nothing into the authenticated type', () => {
    // ⚠️ The brand is only worth something while the cast that defeats it lives
    // in exactly one place — `authenticatedOrganizationIdOf`, in @age/entitlement.
    expect(source).not.toContain('as AuthenticatedOrganizationId');
  });

  it('imports the outside-the-repository rule instead of re-implementing it', () => {
    // 🛑 ADR-0054 D3. A second copy of a fail-closed rule drifts silently, and
    // the copy that gets relaxed still passes its own tests.
    expect(source).toContain("from '@age/operator-file-policy'");
    expect(source).not.toContain('is inside the repository working tree');
  });

  it('states what it permits rather than what it forbids', () => {
    // ⚠️ A deny-list of `..` and `/` leaves every encoding nobody thought of.
    expect(source).toContain('SAFE_SEGMENT');
    expect(source).toMatch(/SAFE_SEGMENT\s*=\s*\/\^/);
  });

  it('is not mistaken for an authorization anywhere in the package', () => {
    // 🚫 A per-tenant directory is a placement rule. Who may read what is
    // `askEntitlement` (A2/A3), which this package does not call.
    for (const file of FILES) {
      expect(stripComments(readFileSync(file, 'utf8')), file).not.toContain('askEntitlement');
    }
  });
});
