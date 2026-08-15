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
  // ⚠️ ADR-0064 D1 NARROWED THIS LIST, IT DID NOT DELETE FROM IT. The console
  // may now read the stored row — through the ADR-0055 D2 façade, from the one
  // effect module, and nowhere else. 🚫 A screen, a client component or a
  // second server module importing the composition entry point is how a read
  // surface acquires a live connection it was never meant to hold.
  '@age/capture/composition',
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

  /**
   * 🚫 The snapshot store is reached through the ADR-0055 D2 façade and NOTHING
   * ELSE.
   *
   * ⚠️ MADE TO FAIL BEFORE IT WAS TRUSTED: importing `@age/capture/composition`
   * into `intelligence-screen.tsx` names that file, and dropping
   * `narrowSnapshotRead` from the effect module fails the second assertion.
   * 🚫 Narrowing, not deleting — the console reads one row and cannot address a
   * second by id (ADR-0055 §5 item 1).
   */
  it('reads the snapshot store only through the narrowed façade', () => {
    const raw = readFileSync(`${srcDir}${EFFECT_MODULE}`, 'utf8');
    // ⚠️ The negative assertions read the STRIPPED source: the module's own
    // explanation of why it drops `findBySnapshotId` names it, and a guard that
    // fails on its own documentation gets deleted rather than fixed.
    const source = withoutComments(raw);

    expect(source).toContain("from '@age/capture/deployed-composition'");
    expect(source).toContain('narrowSnapshotRead(');
    // 🚫 Never a repository, never a Prisma client, never an append.
    expect(source).not.toContain('ScopedScoredBifSnapshotRepository');
    expect(source).not.toContain('new PrismaClient(');
    expect(source).not.toContain('findBySnapshotId');
  });

  /**
   * 🛑 THE CONSOLE OPENS THE **DEPLOYED** DOORS, NEVER THE LOCAL ONES (ADR-0061
   * A5, wired by ADR-0074 §7 slice 1).
   *
   * ⚠️ WHY A GUARD AND NOT A COMMENT. Both sets of doors compile, both accept a
   * loopback target, and on the operator's own laptop both behave identically.
   * The difference only shows up on the VPS, where the local rule's sentence —
   * "this database is on the machine you are sitting at" — is FALSE while its
   * check still passes. Reverting to the local import is therefore a change no
   * test would otherwise notice and no reviewer would see fail.
   *
   * ⚠️ MADE TO FAIL BEFORE IT WAS TRUSTED: swapping the import back to
   * `@age/capture/composition` fails the first assertion, and deleting the
   * acknowledgement constant fails the third.
   */
  it('opens the deployed database doors and writes the acknowledgement out', () => {
    const source = withoutComments(readFileSync(`${srcDir}${EFFECT_MODULE}`, 'utf8'));

    expect(source).not.toContain("from '@age/capture/composition'");
    expect(source).not.toContain('openLocalPrisma');
    expect(source).toContain('REMOTE_ACKNOWLEDGEMENT');
    expect(source).toContain('acknowledgedRemote:');

    // 🚫 The choice is made in SOURCE, never by configuration. An environment
    // read here would be A5's refused `allowRemote` flag under another name.
    expect(source).not.toContain('AGE_DEPLOYED');
    expect(source).not.toContain('NODE_ENV');
  });

  /**
   * 🛑 THE SESSION DOOR IS OPENED HERE AND NOWHERE ELSE (ADR-0074 §7 slice 2).
   *
   * ⚠️ WHY A GUARD. `session-boundary.ts` is where a shortcut would be taken —
   * it is the module that WANTS a clock (to date a revocation) and the database
   * (to look a row up), and both are one import away. If it grew either, the
   * boundary would still work and no other test would notice; the BANNED scan
   * above catches the tokens, and this catches the inverse — the effect module
   * quietly losing them.
   *
   * ⚠️ MADE TO FAIL BEFORE IT WAS TRUSTED: deleting the `verifySessionToken`
   * wrapper fails the second assertion, and moving `new Date()` into
   * `session-boundary.ts` fails the BANNED scan by name.
   */
  it('opens the session door from the one effect module', () => {
    const source = withoutComments(readFileSync(`${srcDir}${EFFECT_MODULE}`, 'utf8'));

    expect(source).toContain("from '@age/capture/deployed-session-composition'");
    expect(source).toContain('verifyPresentedSessionToken(');
    expect(source).toContain('AGE_STUDIO_ORGANIZATION_ID');

    // 🚫 The console still cannot construct its own client or its own runner.
    // The narrowed door is the only way in.
    expect(source).not.toContain('PrismaOperatorSessionScopeRunner');
    expect(source).not.toContain('operatorSessionRevocation(');
  });
});
