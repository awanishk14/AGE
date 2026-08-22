import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * ADR-0090 §5 GUARD 5 — 🛑 **THE PURE PACKAGE STILL MINTS NOTHING.**
 *
 * ADR-0090 D3 put the mint at the effect edge and passes the identity IN. The
 * cheapest way to undo that is to notice, six months from now, that
 * `clientRecordDraftFromFormEntries` "could just make its own id" — one line,
 * no imports to explain, every existing test still green.
 *
 * ⚠️ **THE SCAN IS PACKAGE-WIDE ON PURPOSE.** Several view specs already assert
 * `Date.now(` and `Math.random(` are absent from THEIR OWN source, and every
 * one of those passes while a neighbouring module grows a clock. 🛑 A narrow
 * scan is not a narrow rule.
 *
 * 🚫 Do not add an exemption. If something here needs randomness or a clock, it
 * needs to be given the value by its caller instead.
 */

const srcDir = `${resolve(process.cwd(), 'src').replace(/\\/g, '/')}/`;

const BANNED = [
  'randomUUID',
  'randomBytes',
  'Math.random(',
  'Date.now(',
  'new Date(',
  'node:crypto',
  "from 'crypto'",
];

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = `${directory}${entry}`;
    if (statSync(full).isDirectory()) {
      return sourceFiles(`${full}/`);
    }
    return /\.tsx?$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry) ? [full] : [];
  });
}

describe('@age/studio-shell is pure', () => {
  it('holds no source of randomness and no clock, anywhere', () => {
    const offences = sourceFiles(srcDir).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return BANNED.filter((banned) => source.includes(banned)).map(
        (banned) => `${file.slice(srcDir.length)}: ${banned}`,
      );
    });

    // ⚠️ The failure names the FILE and the TOKEN, 🚫 not just a count: a guard
    // that fails with "expected 1 to be 0" sends the next person searching.
    expect(offences).toEqual([]);
  });

  it('scanned something, so an empty result means clean and 🚫 not missing', () => {
    // 🛑 The scan above passes vacuously if `srcDir` is ever wrong — which is
    // exactly how a moved test file turns a guard into decoration.
    expect(sourceFiles(srcDir).length).toBeGreaterThan(20);
  });
});
