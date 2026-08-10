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
const READ = stripComments(readFileSync(join(SRC, 'entitled-organization-read.ts'), 'utf8'));

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
    '@age/session-store',
    'SET LOCAL',
  ])('contains no %s', (token) => {
    let examined = 0;
    for (const file of FILES) {
      examined += 1;
      expect(stripComments(readFileSync(file, 'utf8')), file).not.toContain(token);
    }
    expect(examined).toBe(FILES.length);
  });
});

describe('🚫 nothing here issues, mints, stores or provisions', () => {
  // ADR-0068 §0.1c refuses each of these by name. 🛑 VERIFICATION IS NOT
  // ISSUANCE, and this package does neither.
  it.each([
    'login',
    'signIn',
    'sign-in',
    'cookie',
    'issue',
    'mint',
    'provision',
    'password',
    'argon2',
    'bearer',
    'middleware',
    'businessOwner',
    'business-owner',
  ])('contains no %s', (token) => {
    let examined = 0;
    for (const file of FILES) {
      examined += 1;
      expect(stripComments(readFileSync(file, 'utf8')).toLowerCase(), file).not.toContain(
        token.toLowerCase(),
      );
    }
    expect(examined).toBe(FILES.length);
  });
});

describe('the decision happens before the query', () => {
  it('asks the entitlement question before `openQuery` appears at all', () => {
    const asked = READ.indexOf('askEntitlement({');
    const opened = READ.indexOf('openQuery(');

    expect(asked).toBeGreaterThan(-1);
    expect(opened).toBeGreaterThan(-1);
    // 🛑 ADR-0068 §0.1d. Textual order is not execution order on its own — the
    // spec proves the execution — but a reordering here is the change that
    // would make the spec's spy the only thing standing between a refused read
    // and a real query.
    expect(asked).toBeLessThan(opened);
  });

  it('calls the query exactly once, and only through the accepted context', () => {
    expect(READ.match(/openQuery\(/g)?.length).toBe(1);
    expect(READ).toContain('openQuery(acceptSessionScopedClientContext(');
  });

  it('🚫 refuses rather than returning an empty result', () => {
    // ADR-0068 §4: [] is indistinguishable from a tenant with no rows.
    expect(READ).toContain("if (decision.answer !== 'granted') {");
    expect(READ).not.toContain('return [];');
    expect(READ).not.toContain('?? []');
  });
});

describe('the entitlement question is asked, not reimplemented', () => {
  it('holds no second copy of the decision', () => {
    // 🛑 The `openLocalPrismaCaptureConnection` reason, unchanged: the copy that
    // gets relaxed still passes its own tests.
    // 🚫 It never PRODUCES an answer — it reads the one the decision returned.
    expect(READ).not.toContain("answer: '");
    // It carries the decision's own words through, 🚫 never writing its own.
    expect(READ).toContain('decision.because');
    // The decision is consulted exactly once, and 🚫 never re-derived.
    expect(READ.match(/decision\.answer/g)?.length).toBe(2);
    expect(READ).toContain("decision.answer !== 'granted'");
    expect(READ).not.toContain('organizationId ===');
    expect(READ).not.toContain('=== session.organizationId');
  });

  it('🚫 has no bypass arm of any kind', () => {
    for (const token of ['allowAll', 'isAdmin', 'SYSTEM_', 'skipEntitlement', 'default:']) {
      expect(READ, token).not.toContain(token);
    }
  });

  it('asks about the organization, 🚫 never letting the caller choose the subject', () => {
    expect(READ).toContain(
      "subject: { kind: 'organization', organizationId: requested.organizationId }",
    );
    expect(READ.match(/subject:/g)?.length).toBe(1);
  });
});
