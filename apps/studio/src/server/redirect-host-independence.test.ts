import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 🛑 **NO REDIRECT IN THIS APP MAY BE BUILT FROM THE REQUEST'S OWN HOST.**
 *
 * ⚠️ MEASURED ON THE REAL DEPLOYMENT: inside its container the console binds
 * `0.0.0.0`, so `new URL('/sign-in', request.url)` produced
 * `http://0.0.0.0:3100/sign-in` and a refused sign-in sent the browser to an
 * address that is not a destination.
 *
 * 🚫 The repair is NOT a forwarded-host header. `request.url` is derived from a
 * header the CALLER controls, so an absolute redirect built from it lets that
 * caller choose where a refusal lands — on the one route an unauthenticated
 * caller on the public internet can reach. A relative `Location` is resolved by
 * the browser against the address it actually used, and there is then no host in
 * this code at all to poison.
 *
 * ⚠️ The walk asserts it FOUND FILES before reporting compliance, and comments
 * are stripped before scanning so this file's own explanation of the rule cannot
 * satisfy it.
 */

const APP_DIRECTORY = join(process.cwd(), 'src', 'app');

function uncommented(source: string): string {
  return source.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/\/\/.*$/gm, '');
}

function routeFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return routeFiles(path);
    }

    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('redirects are independent of the request host', () => {
  it('🚫 builds no URL from `request.url`', () => {
    const files = routeFiles(APP_DIRECTORY);

    expect(
      files.length,
      'the walk found no route files — an empty scan is not compliance',
    ).toBeGreaterThan(0);

    let examined = 0;

    for (const file of files) {
      examined += 1;

      const body = uncommented(readFileSync(file, 'utf8'));

      expect(body, `${file} builds an absolute URL from the caller's own request`).not.toMatch(
        /new URL\([^)]*request\.url/,
      );
      expect(body, `${file} reads a forwarded host header`).not.toMatch(/x-forwarded-host/i);
    }

    expect(examined).toBe(files.length);
  });
});
