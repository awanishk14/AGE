import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 🛑 **THE CONSOLE GAINING A LOGIN DID NOT MOVE THIS APP'S TRUST BOUNDARY** —
 * ADR-0074 §7 slice 2.
 *
 * ⚠️ **WHY THIS TEST EXISTS AT ALL.** The Product Owner refused, by name, *"no
 * authentication middleware that accidentally changes the trust boundary of
 * unrelated inbound tools"*. The accident it names is a real and ordinary one:
 * somebody adds a session check "everywhere", and `apps/mcp` — whose boundary
 * was settled by ADR-0060 and whose tools deliberately take no `clientId` —-
 * silently acquires a notion of an authenticated caller it was designed not to
 * have. 🚫 A comment saying "we did not do that" is not evidence; this is.
 *
 * 🛑 **WHAT IT ASSERTS IS ABSENCE.** `apps/mcp` imports nothing from the session
 * or entitlement boundary, and names none of its vocabulary. If a later slice
 * genuinely needs an authenticated peer protocol, that is ADR-0071 D3's own ADR
 * — 🚫 it does not arrive by an import landing here.
 */

const SRC = resolve(process.cwd(), 'src');

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    // ⚠️ SHIPPED SOURCE ONLY. This file's own `FORBIDDEN` list names every
    // token it forbids, in code rather than in a comment, so a scan that
    // included specs would report itself and get deleted rather than fixed.
    return /\.tsx?$/.test(entry) && !/\.spec\.tsx?$/.test(entry) ? [full] : [];
  });
}

/** ⚠️ A file's own explanation of a rule must not be mistaken for the rule. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const FORBIDDEN = [
  '@age/session-store',
  '@age/session-store-persistence',
  '@age/session-cookie',
  '@age/entitlement',
  '@age/entitled-read',
  '@age/auth-rate-limit',
  'requireVerifiedSession',
  'verifyPresentedSessionToken',
  'askEntitlement',
  'VerifiedSession',
];

describe('🛑 apps/mcp keeps the trust boundary ADR-0060 settled', () => {
  const files = sourceFiles(SRC);

  it('found source files to scan', () => {
    // ⚠️ An empty walk must never be able to report compliance.
    expect(files.length).toBeGreaterThanOrEqual(3);
  });

  it.each(FORBIDDEN)('names no %s anywhere', (token) => {
    let examined = 0;
    const offenders: string[] = [];

    for (const file of files) {
      examined += 1;
      if (stripComments(readFileSync(file, 'utf8')).includes(token)) {
        offenders.push(file.slice(SRC.length + 1));
      }
    }

    expect(examined).toBe(files.length);
    expect(offenders).toEqual([]);
  });

  it('🚫 has no session or entitlement package in its manifest either', () => {
    const manifest = readFileSync(resolve(process.cwd(), 'package.json'), 'utf8');

    // ⚠️ Source and manifest both, because a dependency that is declared but not
    // yet imported is a dependency somebody is about to import.
    for (const token of FORBIDDEN.filter((name) => name.startsWith('@age/'))) {
      expect(manifest, token).not.toContain(token);
    }
  });
});
