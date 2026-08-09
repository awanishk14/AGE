import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

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
const RULE = stripComments(readFileSync(join(SRC, 'tenant-isolation.ts'), 'utf8'));

describe('the package decides and performs nothing', () => {
  it('found source files to scan', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(2);
  });

  it.each([
    'process.env',
    'node:fs',
    'fetch(',
    'new Date(',
    'Date.now(',
    'Math.random(',
    '@prisma/client',
    '@age/persistence',
    'SET LOCAL',
    'app.current_',
  ])('contains no %s', (token) => {
    let examined = 0;
    for (const file of FILES) {
      examined += 1;
      expect(stripComments(readFileSync(file, 'utf8')), file).not.toContain(token);
    }
    expect(examined).toBe(FILES.length);
  });
});

describe('the rule is not written against row-level security', () => {
  it('mentions no policy, no transaction and no SQL', () => {
    // 🛑 A6 item 5 says the test must not be written against RLS as though it
    // were the boundary. Neither may the rule: RLS checks the declared scope
    // against the row, 🚫 never that the declared scope is the caller's own.
    for (const token of ['rls', 'policy', 'transaction', 'select ', 'prisma']) {
      expect(stripComments(RULE).toLowerCase(), token).not.toContain(token);
    }
  });

  it('takes the organization from the session type, which a string cannot satisfy', () => {
    expect(RULE).toContain("import type { AuthenticatedOrganizationId } from '@age/entitlement'");
    expect(RULE).toContain('readonly organizationId: AuthenticatedOrganizationId;');
    // 🚫 A cast here would let a request parameter reach the comparison.
    expect(RULE).not.toContain('as AuthenticatedOrganizationId');
  });

  it('compares the requested organization against the session, exactly once', () => {
    expect(RULE).toContain('requested.organizationId !== organizationId');
    expect(RULE.match(/requested\.organizationId/g)?.length).toBe(1);
  });
});

describe('a mismatch is refused, never narrowed', () => {
  it('throws on mismatch instead of substituting the session organization', () => {
    const comparison = RULE.indexOf('requested.organizationId !== organizationId');
    const afterwards = RULE.slice(comparison);

    expect(comparison).toBeGreaterThan(-1);
    // ⚠️ The next thing that happens must be a refusal. A `return new
    // ClientContext(...)` inside this branch is the silent narrowing.
    expect(afterwards.indexOf('throw new TenantIsolationRefusedError')).toBeLessThan(
      afterwards.indexOf('return new ClientContext'),
    );
  });

  it('offers no filtering alternative to refusing', () => {
    // 🚫 `.filter(` on rows would hand back a plausible, quietly short answer.
    expect(RULE).not.toContain('.filter(');
    expect(RULE).not.toMatch(/export function \w*[Ff]ilter/);
  });
});

describe('there is no bypass', () => {
  it.each(['isadmin', 'admin', 'superuser', 'override', 'bypass', 'allowcross', 'trusted', 'skip'])(
    'declares no %s',
    (token) => {
      // 🚫 ADR-0062 D3 — admin is never a bypass. An administrator reading a
      // tenant's rows reads them as that tenant.
      for (const file of FILES) {
        expect(stripComments(readFileSync(file, 'utf8')).toLowerCase(), file).not.toContain(token);
      }
    },
  );

  it('does not answer the entitlement question', () => {
    // 🛑 Isolation settles WHICH ROWS a session may address. 🚫 It does not
    // settle who may act — that is `askEntitlement`, which still has no caller
    // anywhere, deliberately (ADR-0055 D7 is undischarged).
    for (const file of FILES) {
      expect(stripComments(readFileSync(file, 'utf8')), file).not.toContain('askEntitlement');
    }
  });

  it('has no permissive default anywhere', () => {
    expect(RULE).not.toContain('?? true');
    expect(RULE).not.toContain('|| true');
    expect(RULE).not.toMatch(/organizationId\s*\?\?/);
  });
});

describe('a refusal names a position, never a tenant', () => {
  it('interpolates only the subject into a message', () => {
    const interpolations = RULE.match(/\$\{[^}]+\}/g) ?? [];

    expect(interpolations.length).toBeGreaterThan(0);
    for (const interpolation of interpolations) {
      expect(interpolation).toBe('${named}');
    }
  });

  it('never interpolates an identifier', () => {
    for (const token of ['${organizationId}', '${clientId}', '${row.', '${requested.']) {
      expect(RULE, token).not.toContain(token);
    }
  });
});
