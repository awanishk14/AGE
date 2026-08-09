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
const COOKIE = stripComments(readFileSync(join(SRC, 'session-cookie.ts'), 'utf8'));

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
    'node:crypto',
    '@prisma/client',
    'setHeader',
    'NextResponse',
  ])('contains no %s', (token) => {
    let examined = 0;
    for (const file of FILES) {
      examined += 1;
      expect(stripComments(readFileSync(file, 'utf8')), file).not.toContain(token);
    }
    expect(examined).toBe(FILES.length);
  });
});

describe('the four attributes are not negotiable', () => {
  it.each(['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/'])(
    'states %s literally, not behind a condition',
    (attribute) => {
      expect(COOKIE).toContain(`'${attribute}'`);
    },
  );

  it('has no attribute that depends on an environment or a flag', () => {
    // 🛑 THE ONE THAT MATTERS. "Secure only in production" is how a session
    // cookie ends up travelling in the clear on the machine that has real data.
    expect(COOKIE).not.toMatch(/Secure[^']*\?/);
    expect(COOKIE).not.toContain('NODE_ENV');
    expect(COOKIE).not.toContain('isProduction');
    expect(COOKIE).not.toContain('isDevelopment');
    expect(COOKIE).not.toContain('insecure');
  });

  it('sets no Domain, ever', () => {
    expect(COOKIE).not.toContain('Domain=');
  });

  it('keeps the __Host- prefix on the name', () => {
    expect(COOKIE).toContain("export const SESSION_COOKIE_NAME = '__Host-age_session';");
  });

  it('builds both cookies from the same frozen attribute list', () => {
    // ⚠️ Two lists is one list somebody updates. The clearing cookie must carry
    // the same attributes or the browser rejects it and the original survives.
    expect(COOKIE.match(/SESSION_COOKIE_ATTRIBUTES/g)?.length).toBeGreaterThanOrEqual(3);
    expect(COOKIE).toContain('Object.freeze([');
  });

  it('takes the lifetime ceiling from the session store, not a literal', () => {
    expect(COOKIE).toContain(
      "import { MAXIMUM_SESSION_LIFETIME_SECONDS } from '@age/session-store';",
    );
    expect(COOKIE).not.toMatch(/12 \* 60 \* 60/);
  });
});

describe('the cookie is a reference, never a claim', () => {
  it('has no place to put a fact', () => {
    for (const token of [
      'organizationId',
      'accountId',
      'isAdmin',
      'role',
      'sign(',
      'jwt',
      'JSON.stringify',
    ]) {
      expect(COOKIE, token).not.toContain(token);
    }
  });

  it('never calls expiring the cookie a logout or a revocation', () => {
    // 🛑 Clearing the cookie ends the browser's habit, not the session. A name
    // that claimed otherwise would be the whole misunderstanding, shipped.
    const source = readFileSync(join(SRC, 'session-cookie.ts'), 'utf8');
    expect(source).not.toMatch(/export function (logout|revoke|endSession|destroySession)/);
    expect(COOKIE).not.toContain('revokedAt');
  });
});
