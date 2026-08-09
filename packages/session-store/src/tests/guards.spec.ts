import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/** ⚠️ Guard-test pattern: the walk asserts it found files, comments are stripped. */

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
const sources = () =>
  FILES.map((file) => [file, stripComments(readFileSync(file, 'utf8'))] as const);

describe('@age/session-store performs no effect', () => {
  it('found source files to scan', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(3);
  });

  it.each([
    '@prisma/client',
    'PrismaClient',
    '@age/persistence',
    'node:fs',
    'fetch(',
    'Date.now(',
    'Math.random(',
    'process.env',
    'randomBytes',
    'randomUUID',
    'randomFillSync',
  ])('contains no %s', (token) => {
    let examined = 0;
    for (const [file, source] of sources()) {
      examined += 1;
      expect(source, file).not.toContain(token);
    }
    expect(examined).toBe(FILES.length);
  });

  it('never constructs a clock', () => {
    // ⚠️ `new Date(instant)` is arithmetic on a value the CALLER supplied and is
    // permitted; `new Date()` reads the machine's clock and is not. The guard
    // has to tell them apart, or it bans the arithmetic and gets deleted.
    let examined = 0;
    for (const [file, source] of sources()) {
      examined += 1;
      expect(source, file).not.toMatch(/new Date\(\s*\)/);
    }
    expect(examined).toBe(FILES.length);
  });

  it('imports exactly the two pure primitives it needs from node:crypto', () => {
    // 🚫 Minting a token is randomness, and randomness is an effect that belongs
    // to a composition root — so the import list itself is pinned.
    const record = stripComments(readFileSync(join(SRC, 'session-record.ts'), 'utf8'));
    expect(record).toContain("import { createHash, timingSafeEqual } from 'node:crypto';");

    const others = sources().filter(([file]) => !file.endsWith('session-record.ts'));
    expect(others.length).toBeGreaterThanOrEqual(2);
    for (const [file, source] of others) {
      expect(source, file).not.toContain('node:crypto');
    }
  });
});

describe('what a session may never carry (ADR-0062 D3, ADR-0053 D4)', () => {
  it.each(['isAdmin', 'role', 'permissions', 'scopes', 'claims'])(
    'has no %s on a session',
    (token) => {
      let examined = 0;
      for (const [file, source] of sources()) {
        examined += 1;
        expect(source, file).not.toContain(token);
      }
      expect(examined).toBe(FILES.length);
    },
  );

  it('never mentions OperatorPrincipal', () => {
    // 🛑 Neither can be built from the other: a caller that authenticates itself
    // by naming itself is the error class ADR-0058 D1 refuses.
    for (const [file, source] of sources()) {
      expect(source, file).not.toContain('OperatorPrincipal');
    }
  });

  it('compares no password and hashes no credential', () => {
    // 🚫 A2: AGE's own code never compares a password.
    for (const [file, source] of sources()) {
      expect(source, file).not.toContain('password');
    }
  });
});

describe('the ceiling and the digest are not negotiable', () => {
  const lifetime = stripComments(readFileSync(join(SRC, 'session-lifetime.ts'), 'utf8'));
  const record = stripComments(readFileSync(join(SRC, 'session-record.ts'), 'utf8'));

  it('states the ceiling as a constant, not a parameter with a default', () => {
    // 🚫 A number read from a variable is a number somebody raises at 2am.
    expect(lifetime).toMatch(/export const MAXIMUM_SESSION_LIFETIME_SECONDS = 12 \* 60 \* 60;/);
    expect(lifetime).not.toMatch(/lifetimeSeconds\s*=\s*\d/);
  });

  it('has no expiry-free session', () => {
    // 🛑 There is no "stay signed in forever": the field is required.
    expect(record).toContain('readonly expiresAt: string;');
    expect(record).not.toMatch(/expiresAt\?:/);
    expect(record).not.toMatch(/expiresAt:\s*string\s*\|\s*null/);
  });

  it('assesses revocation before expiry', () => {
    const revoked = record.indexOf("reason: 'revoked'");
    const expired = record.indexOf("reason: 'expired'");
    expect(revoked).toBeGreaterThan(-1);
    expect(expired).toBeGreaterThan(revoked);
  });

  it('offers no way to read a token back out of a row', () => {
    // 🚫 The raw token is never stored, so there is nothing to read back.
    expect(record).not.toMatch(/readonly token:\s*string/);
    expect(record).toContain('readonly tokenHash: string;');
  });

  it('is not an authorization', () => {
    for (const [file, source] of sources()) {
      expect(source, file).not.toContain('askEntitlement');
    }
  });
});
