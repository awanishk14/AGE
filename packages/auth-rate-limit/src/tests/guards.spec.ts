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
const LIMIT = stripComments(readFileSync(join(SRC, 'auth-rate-limit.ts'), 'utf8'));

describe('the package decides and performs nothing', () => {
  it('found source files to scan', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(2);
  });

  it.each([
    'process.env',
    'node:fs',
    'fetch(',
    'Date.now(',
    'Math.random(',
    '@prisma/client',
    '@age/persistence',
    'setTimeout',
    'setInterval',
  ])('contains no %s', (token) => {
    let examined = 0;
    for (const file of FILES) {
      examined += 1;
      expect(stripComments(readFileSync(file, 'utf8')), file).not.toContain(token);
    }
    expect(examined).toBe(FILES.length);
  });

  it('never constructs a clock', () => {
    // ⚠️ `new Date(recorded)` parses a value the caller supplied and is
    // permitted; `new Date()` reads the machine's clock and is not.
    for (const file of FILES) {
      expect(stripComments(readFileSync(file, 'utf8')), file).not.toMatch(/new Date\(\s*\)/);
    }
  });

  it('stores nothing — the store is a caller problem', () => {
    for (const token of ['Map(', 'Set(', 'let ', 'push(', 'cache']) {
      expect(LIMIT, token).not.toContain(token);
    }
  });
});

describe('both counters exist, and neither is negotiable', () => {
  it('limits by subject and by source, in that order', () => {
    const subject = LIMIT.indexOf('MAXIMUM_FAILURES_PER_SUBJECT');
    const source = LIMIT.indexOf('MAXIMUM_FAILURES_PER_SOURCE');

    expect(subject).toBeGreaterThan(-1);
    expect(source).toBeGreaterThan(subject);
  });

  it('filters on both keys', () => {
    // 🚫 Removing either counter because "the other covers it" is the mistake:
    // per-subject alone is bypassed by spraying, per-source by distributing.
    expect(LIMIT).toContain('failure.subjectKey === input.subjectKey');
    expect(LIMIT).toContain('failure.sourceKey === input.sourceKey');
  });

  it('states the limits as constants, never as parameters with defaults', () => {
    expect(LIMIT).toMatch(/export const MAXIMUM_FAILURES_PER_SUBJECT = \d+;/);
    expect(LIMIT).toMatch(/export const MAXIMUM_FAILURES_PER_SOURCE = \d+;/);
    expect(LIMIT).not.toMatch(/maximumFailures\w*\s*=\s*\d/);
  });

  it('refuses at the limit, not one past it', () => {
    // ⚠️ `>` rather than `>=` is an off-by-one that hands out a free guess.
    expect(LIMIT).toContain('>= MAXIMUM_FAILURES_PER_SUBJECT');
    expect(LIMIT).toContain('>= MAXIMUM_FAILURES_PER_SOURCE');
  });
});

describe('there is no bypass', () => {
  it.each([
    'allowlist',
    'allowList',
    'whitelist',
    'trusted',
    'bypass',
    'skip',
    'exempt',
    'internal',
  ])('declares no %s', (token) => {
    for (const file of FILES) {
      expect(stripComments(readFileSync(file, 'utf8')).toLowerCase(), file).not.toContain(
        token.toLowerCase(),
      );
    }
  });
});

describe('the verdict tells an attacker nothing', () => {
  it('has exactly one refusal reason', () => {
    // ⚠️ Three: the one arm the type declares, and the two places it is
    // returned. A fourth would be a second thing the refusal can say.
    expect(LIMIT.match(/reason: 'too-many-attempts'/g)?.length).toBe(3);
    expect(LIMIT.match(/reason: '/g)?.length).toBe(3);
    expect(LIMIT).not.toContain("reason: 'unknown-subject'");
    expect(LIMIT).not.toContain('exists');
  });

  it('never puts a key in the verdict', () => {
    expect(LIMIT).not.toMatch(/subjectKey,\s*$/m);
    expect(LIMIT).not.toMatch(/allowed: false,\s*\n\s*subjectKey/);
  });

  it('never interprets the subject key', () => {
    // 🚫 Opaque means opaque: no parsing, no lookup, no email shape.
    for (const token of ['@', 'split(', 'toLowerCase()', 'email']) {
      expect(LIMIT, token).not.toContain(token);
    }
  });
});
