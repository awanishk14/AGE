import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Effects live in exactly ONE module.
 *
 * ⚠️ Absence-of-effects alone is not enough, and this repo has been caught by
 * that before: a guard that only asserts "no module has a clock" still passes
 * when a second module quietly grows one, as long as the first is allowed to.
 * So this asserts the stronger property — that `server/operator-environment.ts`
 * is the only place under `src/` that reads the environment or the filesystem.
 *
 * 🚫 Do not add an exemption here. Add the effect to the one module instead.
 */

// ⚠️ Anchored to the package root, not to `import.meta.url` — under this
// vitest config the module URL is not a `file:` URL and cannot be resolved.
const srcDir = `${resolve(process.cwd(), 'src').replace(/\\/g, '/')}/`;

/** The single module permitted to perform an effect. */
const EFFECT_MODULE = 'server/operator-environment.ts';

const BANNED = [
  'process.env',
  'process.cwd(',
  'node:fs',
  'node:os',
  'node:child_process',
  'new Date(',
  'Date.now(',
  'Math.random(',
  'fetch(',
  'localStorage',
  '@prisma/client',
  '@age/persistence',
];

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = `${directory}${entry}`;
    if (statSync(full).isDirectory()) {
      return sourceFiles(`${full}/`);
    }
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

/**
 * ⚠️ Comments are stripped BEFORE scanning. Without this, a module's own
 * explanation of the rule matches the rule and the guard fails on its own
 * documentation.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('apps/studio effect isolation', () => {
  const files = sourceFiles(srcDir);

  it('finds source files to scan', () => {
    // ⚠️ A walk-the-repo guard must first prove the walk found something, or an
    // empty scan reports compliance.
    expect(files.length).toBeGreaterThan(10);
  });

  it('keeps every effect in the one named module', () => {
    let scanned = 0;
    const offenders: string[] = [];

    for (const file of files) {
      const relative = file.slice(srcDir.length);
      scanned += 1;

      if (relative === EFFECT_MODULE) {
        continue;
      }

      const source = withoutComments(readFileSync(file, 'utf8'));
      for (const token of BANNED) {
        if (source.includes(token)) {
          offenders.push(`${relative} contains "${token}"`);
        }
      }
    }

    expect(scanned).toBe(files.length);
    expect(offenders).toEqual([]);
  });

  /**
   * 🚫 `@age/demo-runtime` is never imported bare.
   *
   * ⚠️ Its index exports `runAllCapabilities` and the demo fixtures. Running a
   * capability against a real business is class 3 under ADR-0057 D4, and a demo
   * fixture rendered beside a real client's name is an invented value about that
   * client. The console reaches only the `/context-readiness` subpath, which
   * carries neither.
   *
   * ⚠️ Scans EVERY file including the effect module — this one has no exemption,
   * because the effect module is exactly where the shortcut would be taken.
   */
  it('never reaches the demo runtime index, only the readiness subpath', () => {
    let scanned = 0;
    const offenders: string[] = [];
    // ⚠️ Matches the bare specifier only. `@age/demo-runtime/context-readiness`
    // contains the package name as a prefix, so a plain `includes` would report
    // the permitted import as a violation and the guard would be deleted.
    const bare = /from\s+'@age\/demo-runtime'/;

    for (const file of files) {
      scanned += 1;
      const source = withoutComments(readFileSync(file, 'utf8'));
      if (bare.test(source)) {
        offenders.push(`${file.slice(srcDir.length)} imports @age/demo-runtime bare`);
      }
    }

    expect(scanned).toBe(files.length);
    expect(offenders).toEqual([]);
  });

  it('confirms the one effect module actually performs the effects', () => {
    // ⚠️ Otherwise this guard would keep passing after the effects moved
    // somewhere it does not scan, and report that as compliance.
    const source = readFileSync(`${srcDir}${EFFECT_MODULE}`, 'utf8');

    expect(source).toContain('process.env');
    expect(source).toContain('node:fs');
  });
});
