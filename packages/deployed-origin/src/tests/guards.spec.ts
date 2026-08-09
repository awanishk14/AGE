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
const DECISION = stripComments(readFileSync(join(SRC, 'deployed-origin.ts'), 'utf8'));

describe('the package decides and performs nothing', () => {
  it('found source files to scan', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(2);
  });

  it.each([
    'process.env',
    'node:fs',
    'node:net',
    'node:tls',
    'node:http',
    'node:dns',
    'fetch(',
    'new Date(',
    'Date.now(',
    'Math.random(',
    'console.',
    '@prisma/client',
    '@age/persistence',
  ])('contains no %s', (token) => {
    let examined = 0;
    for (const file of FILES) {
      examined += 1;
      expect(stripComments(readFileSync(file, 'utf8')), file).not.toContain(token);
    }
    expect(examined).toBe(FILES.length);
  });

  it('resolves no name', () => {
    // ⚠️ A lookup here would be both an effect and a lie: a name that resolves
    // to one address today may not tomorrow.
    for (const token of ['lookup(', 'resolve4', 'resolve6', 'getaddrinfo']) {
      expect(DECISION, token).not.toContain(token);
    }
  });
});

describe('there is no way to relax it', () => {
  it.each([
    'allowinsecure',
    'allowhttp',
    'allowplaintext',
    'skiptls',
    'insecure',
    'disabletls',
    'trustproxy',
    'trustallproxies',
    'development',
    'devmode',
  ])('declares no %s', (token) => {
    // 🚫 "The copy that gets relaxed still passes its own tests" — so there is
    // no second, quietly-permitting arm to relax.
    for (const file of FILES) {
      expect(stripComments(readFileSync(file, 'utf8')).toLowerCase(), file).not.toContain(token);
    }
  });

  it('has no arm that returns a transport without checking', () => {
    expect(DECISION).not.toMatch(/return\s+'https'\s*;[\s\S]*return\s+'https'\s*;/);
    expect(DECISION.match(/return 'https';/g)?.length).toBe(1);
  });
});

describe('the bind host is checked before the header is read', () => {
  it('calls the bind rule first in acceptForwardedTransport', () => {
    // 🛑 Reading the header first and the bind host second would still pass
    // every test written about the header.
    const body = DECISION.slice(DECISION.indexOf('export function acceptForwardedTransport'));

    expect(body.indexOf('assertOriginNotPubliclyReachable(input.bindHost)')).toBeGreaterThan(-1);
    expect(body.indexOf('assertOriginNotPubliclyReachable(input.bindHost)')).toBeLessThan(
      body.indexOf('input.forwardedProto'),
    );
  });

  it('states the bind hosts as an allow-list, not a pattern', () => {
    // 🚫 A `127.x` pattern invites its own widening.
    expect(DECISION).toContain("ORIGIN_BIND_HOSTS = Object.freeze(['127.0.0.1', '::1']");
    expect(DECISION).not.toMatch(/startsWith\('127\./);
  });
});

describe('a refusal names a position, never a value', () => {
  it('interpolates nothing into a message', () => {
    // 🚫 Not one interpolation anywhere in the module: a URL can carry a token
    // in its query and a credential in its authority.
    expect(DECISION.match(/\$\{[^}]+\}/g) ?? []).toEqual([]);
  });
});
