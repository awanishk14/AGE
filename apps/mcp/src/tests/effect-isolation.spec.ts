import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * This app's own effect-isolation guard (ADR-0060 D8 item 2).
 *
 * ⚠️ EACH SURFACE SUPPLIES ITS OWN RUNTIME AND ITS OWN GUARD (D2). This is a
 * near-copy of the console's, deliberately: the console's guard scans
 * `apps/studio` and would report this app's compliance without ever looking at
 * it. ⚠️ ADR-0060 §6 Q3 is open on whether the two effects modules should
 * themselves be deduplicated — 🚫 that is a decision, not a cleanup, and it must
 * not be made by quietly deleting one of these guards.
 *
 * ⚠️ Guard-test pattern: the walk asserts it found files first, so an empty scan
 * can never report compliance; comments are stripped, or this module's own
 * explanation of a rule matches it; excluded directories are pruned DURING the
 * recursion, never filtered afterwards (the ENOENT that failed CI twice, #244).
 *
 * ⚠️ Every assertion here was MADE TO FAIL by mutating the thing it protects and
 * confirming it named the mutation, then restored.
 */

const SRC = join(__dirname, '..');
const EXCLUDED = new Set(['node_modules', 'dist', '.turbo']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (EXCLUDED.has(entry)) return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const EFFECTS_MODULE = join(SRC, 'main.ts');
const THIS_GUARD = join(SRC, 'tests', 'effect-isolation.spec.ts');

/**
 * ⚠️ THIS FILE IS EXCLUDED FROM ITS OWN SCANS, and that is a real gap, stated
 * rather than hidden: the banned tokens below appear here as string literals, so
 * a guard that scanned itself would fail on its own subject matter — the same
 * trap comment-stripping solves for prose. The exclusion is exactly one named
 * path, never a pattern, so a second file cannot drift out of coverage; and the
 * counts asserted below are taken AFTER the exclusion, so a scan that examined
 * nothing still cannot pass.
 */
const ALL = sourceFiles(SRC).filter((file) => file !== THIS_GUARD);

/** The specs and their fake runtime are not production modules. */
const PRODUCTION = ALL.filter((file) => !file.endsWith('.spec.ts') && !file.includes('tests'));

describe('effects live in exactly one module', () => {
  it('found this app’s source tree to scan', () => {
    expect(ALL.length).toBeGreaterThan(3);
    expect(PRODUCTION).toContain(EFFECTS_MODULE);
  });

  /**
   * 🚫 `node:path` is deliberately absent — `join` decides about a STRING and
   * touches nothing, the same reasoning `@age/operator-file-policy` relies on.
   */
  const BANNED = [
    'node:fs',
    'node:os',
    'node:net',
    'node:http',
    'node:child_process',
    'process.env',
    'process.cwd',
    'process.stdout',
    'process.stdin',
    'new Date(',
    'Date.now(',
    'Math.random(',
    'fetch(',
    '@prisma/client',
    '@age/persistence',
    '@age/bif',
  ];

  it.each(BANNED)('no module except main.ts contains %s', (token) => {
    let examined = 0;
    for (const file of PRODUCTION) {
      if (file === EFFECTS_MODULE) continue;
      examined += 1;
      expect(stripComments(readFileSync(file, 'utf8'))).not.toContain(token);
    }
    expect(examined).toBe(PRODUCTION.length - 1);
  });

  /**
   * ⚠️ THE POSITIVE HALF. Absence of effects everywhere else is equally
   * satisfied by an app that performs no effect at all and therefore does
   * nothing — the failure mode this repo refuses everywhere: a surface that
   * answers "nothing here" to every question, indistinguishable from a business
   * AGE looked at and found empty.
   */
  it('and main.ts really does hold them', () => {
    const source = stripComments(readFileSync(EFFECTS_MODULE, 'utf8'));

    expect(source).toContain('node:fs');
    expect(source).toContain('process.env');
    expect(source).toContain('process.stdout');
  });
});

describe('this server binds nothing', () => {
  /**
   * 🛑 ADR-0060 D8 item 2. A server that listens admits a second party, and a
   * caller-asserted `OperatorPrincipal` then becomes a caller granting itself
   * access by naming itself (D5) — ADR-0061's problem, and ADR-0061 is
   * `Proposed`. ⚠️ The bundle asserts this too, over the artefact that actually
   * runs; this asserts it over the source, where it would first be written.
   */
  const NO_LISTENER = ['createServer', '.listen(', 'WebSocket', 'express', 'node:https'];

  it.each(NO_LISTENER)('no source file contains %s', (token) => {
    let examined = 0;
    for (const file of ALL) {
      examined += 1;
      expect(stripComments(readFileSync(file, 'utf8'))).not.toContain(token);
    }
    expect(examined).toBe(ALL.length);
  });
});

describe('no model call enters AGE', () => {
  /** 🛑 ADR-0060 D7. AGE is the server; the model is its client. */
  const NO_MODEL = ['openai', 'anthropic', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY'];

  it.each(NO_MODEL)('no source file mentions %s', (token) => {
    let examined = 0;
    for (const file of ALL) {
      examined += 1;
      expect(stripComments(readFileSync(file, 'utf8')).toLowerCase()).not.toContain(
        token.toLowerCase(),
      );
    }
    expect(examined).toBe(ALL.length);
  });
});
