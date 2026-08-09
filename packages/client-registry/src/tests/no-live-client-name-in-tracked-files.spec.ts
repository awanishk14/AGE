import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  containsAnyNameDigest,
  containsForbiddenClientName,
  forbiddenNameDigestOf,
} from '../forbidden-client-names';

/**
 * ADR-0065 D2 — no live client's name appears in any file git tracks.
 *
 * WHY THIS GUARD EXISTS, AND WHAT IT IS AN ANSWER TO. ADR-0053 D3 has said
 * since it was written that real client records are never committed, "not even
 * a redacted or partially-masked one". The guard shipped for it scanned the
 * committed fixtures in this package — and ADR-0053's OWN PROSE spelled both
 * live client names, in two places, for seven days. The document stating the
 * rule was the document breaking it.
 *
 * ⚠️ The gap was never a missing scan. It was reading "a client record" as "a
 * record-shaped object". A name in a sentence identifies the client at least as
 * well as a name in a `displayName` field, and prose is what search indexes.
 *
 * ⚠️ WHY `git ls-files` AND NOT A DIRECTORY WALK. The rule is "never
 * COMMITTED", so the oracle must be what git tracks. That is not a convenience:
 * the operator's working memory (`CLAUDE.md`) and standing context
 * (`docs/AGE_STANDING_CONTEXT.md`) hold the live names LEGITIMATELY and are
 * untracked by rule. A directory walk would fail on the operator's machine and
 * pass in CI — a guard that cries wolf locally is a guard that gets disabled.
 *
 * 🚫 NO FAILURE MESSAGE EVER CARRIES THE MATCH. It names the file only. CI logs
 * are public, and a guard that printed the name it found would publish exactly
 * what it exists to suppress — which is why `containsForbiddenClientName`
 * returns a boolean and not the matched text.
 */

const repositoryRoot = resolve(__dirname, '..', '..', '..', '..');

/**
 * Extensions worth reading as text.
 *
 * ⚠️ THE EXCLUSIONS ARE DELIBERATE AND ARE ASSERTED BELOW, never silent. A
 * guard that quietly skipped half the repository would report compliance it had
 * not established (ADR-0065 D2).
 */
const TEXT_EXTENSIONS =
  /\.(md|mdx|txt|ts|tsx|js|jsx|mjs|cjs|json|ya?ml|sql|prisma|css|html|sh|toml)$/i;

/**
 * 🚫 Lockfiles are skipped. They are machine-generated dependency graphs,
 * megabytes wide, and the sliding-window hash over one costs more than the rest
 * of the repository combined. ⚠️ The exclusion is named here rather than left
 * implicit, and it is narrow: a lockfile records package names, not clients.
 */
const SKIPPED = /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/;

function trackedFiles(): readonly string[] {
  const listing = execFileSync('git', ['ls-files', '-z'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  return listing.split('\0').filter((path) => path.length > 0);
}

describe('no live client name appears in any tracked file', () => {
  const tracked = trackedFiles();
  const scannable = tracked.filter((path) => TEXT_EXTENSIONS.test(path) && !SKIPPED.test(path));

  it('found the files it claims to scan', () => {
    // 🚫 An empty or failed walk must never be able to report compliance.
    expect(tracked.length).toBeGreaterThan(200);
    expect(scannable.length).toBeGreaterThan(200);
  });

  it('has the directory that actually leaked in scope', () => {
    // ⚠️ ADR-0053 is where the names were. Its presence in the scan list is the
    // difference between this guard and the one it replaces, so it is asserted
    // rather than presumed.
    const adrs = scannable.filter((path) => path.startsWith('docs/adrs/'));

    expect(adrs.length).toBeGreaterThan(0);
    expect(scannable).toContain('docs/adrs/0053-client-registry-and-operator-principal.md');
  });

  it('names no live client of the operator, in any tracked file', () => {
    const offenders: string[] = [];
    let examined = 0;

    for (const path of scannable) {
      let contents: string;
      try {
        contents = readFileSync(join(repositoryRoot, path), 'utf8');
      } catch {
        // A tracked path that cannot be read is not silently passed over: it is
        // reported as an offender so the walk can never shrink unnoticed.
        offenders.push(`${path} (unreadable)`);
        continue;
      }

      examined += 1;

      if (containsForbiddenClientName(contents)) {
        // 🚫 The path only. Never the match, never the surrounding line.
        offenders.push(path);
      }
    }

    expect(examined).toBe(scannable.length);
    expect(offenders).toEqual([]);
  });
});

/**
 * The mechanism, proved against a name that is obviously fictional.
 *
 * ⚠️ A GUARD IS EVIDENCE ONLY ONCE IT HAS BEEN MADE TO FAIL. Feeding a real
 * forbidden name to the real digest list would reintroduce the exact leak this
 * module removes, so the scan is proved here against digests built from a
 * fictional name — the same technique `forbidden-client-names.spec.ts` uses.
 */
describe('the tracked-file scan actually detects a planted name', () => {
  const FICTIONAL = 'Fictional Aardvark Holdings';
  const digests = [forbiddenNameDigestOf(FICTIONAL)];

  it('finds the name inside a document that merely mentions it', () => {
    const document = [
      '# An ADR that names a client in prose',
      '',
      `Two live clients were nominated: **${FICTIONAL}** and one other.`,
      '',
      'Nothing else here is interesting.',
    ].join('\n');

    expect(containsAnyNameDigest(document, digests)).toBe(true);
  });

  it('finds it across a spelling nobody listed', () => {
    // ⚠️ The normalisation is what buys this: one digest covers spaced,
    // hyphenated and run-together spellings.
    expect(containsAnyNameDigest('fictional-aardvark-holdings', digests)).toBe(true);
    expect(containsAnyNameDigest('FictionalAardvarkHoldings', digests)).toBe(true);
  });

  it('does not fire on an unrelated document', () => {
    expect(containsAnyNameDigest('a document about aardvarks generally', digests)).toBe(false);
  });
});
