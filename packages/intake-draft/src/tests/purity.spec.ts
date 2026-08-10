import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * ADR-0066 **D4** (§0.5) — *"The persistence mechanism for making the draft
 * durable is a separate decision and must not be smuggled into D4."*
 *
 * 🚫 **THIS PACKAGE PERSISTS NOTHING, AND MUST NOT LEARN HOW.** A store added
 * here would discharge a decision the Product Owner explicitly held back, and
 * schema/migration/RLS is independently a §3 stop condition. The same scan keeps
 * the package deterministic — a clock or an id generator here would make a
 * draft's contents depend on when it was built.
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

const BANNED_TOKENS = [
  'node:fs',
  'node:path',
  '@prisma/client',
  '@age/persistence',
  'process.env',
  'new Date(',
  'Date.now(',
  'Math.random(',
  'performance.now(',
  'fetch(',
  'localStorage',
] as const;

function moduleSources(): readonly { readonly file: string; readonly source: string }[] {
  return readdirSync(SRC)
    .filter((entry) => entry.endsWith('.ts'))
    .map((entry) => ({
      file: entry,
      // ⚠️ Comments are stripped first: this package's own documentation names
      // persistence and the clock in order to forbid them, and a scan that
      // matched the explanation would fail for the opposite of the right reason.
      source: readFileSync(join(SRC, entry), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, ''),
    }));
}

describe('@age/intake-draft is pure and stores nothing', () => {
  it('scanned real modules, so a passing scan cannot mean an empty one', () => {
    const modules = moduleSources();

    expect(modules.length).toBeGreaterThan(0);
    expect(modules.map((module) => module.file)).toContain('intake-draft.ts');
    expect(modules.every((module) => module.source.length > 100)).toBe(true);
  });

  it.each(BANNED_TOKENS)('🚫 no module reaches for `%s`', (token) => {
    for (const { file, source } of moduleSources()) {
      expect(source, `${file} must not contain ${token}`).not.toContain(token);
    }
  });

  it('examined every token the purity rule covers', () => {
    // ⚠️ Sentinel: a rewrite that empties the token list must fail here rather
    // than report eleven passing checks it never ran.
    expect(BANNED_TOKENS).toHaveLength(11);
  });
});
