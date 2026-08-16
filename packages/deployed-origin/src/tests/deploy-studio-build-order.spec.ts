import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The one ordering in the deploy script that a green repository cannot see.
 *
 * 🛑 **`prisma:generate` MUST RUN BEFORE `next build`.** Next traces
 * `@prisma/client` into `.next/server/chunks/*` at BUILD time. If no client has
 * been generated at that moment, the STUB is what gets bundled — and the
 * resulting deployment looks entirely healthy: it starts, serves `/sign-in`,
 * and redirects every protected route to it exactly as designed. It fails only
 * when a REAL SESSION IS PRESENTED, with
 * `@prisma/client did not initialize yet`, as a 500 from
 * `/sign-in/submit`.
 *
 * ⚠️ **GENERATING AFTERWARDS DOES NOT FIX IT.** The stub is already inside the
 * bundle; the fix is a rebuild. That is why the assertion here is on the
 * ORDER and not merely on the presence of the step.
 *
 * ⚠️ This was MEASURED on the real VPS while every test in this repository was
 * green — the class of defect no unit test reaches, because both halves are
 * individually correct and only their sequence is wrong.
 */

/**
 * ⚠️ **THIS GUARD MOVED WITH THE BUILD, IT WAS NOT WEAKENED.** ADR-0076 D1 put
 * the console in a container, so the install-generate-build sequence is no
 * longer three lines of one ssh invocation — it is three `RUN` layers of
 * `apps/studio/Dockerfile`. The failure it protects against is UNCHANGED and
 * still invisible to a green repository, so the assertions follow the steps to
 * their new home rather than being deleted with them.
 */
const REPO = join(__dirname, '..', '..', '..', '..');
const DOCKERFILE_PATH = join(REPO, 'apps', 'studio', 'Dockerfile');

const DOCKERFILE = readFileSync(DOCKERFILE_PATH, 'utf8');

/** ⚠️ Comments come off first — this file's own explanation names both steps. */
const BUILD_BODY = DOCKERFILE.split('\n')
  .filter((line) => !line.trimStart().startsWith('#'))
  .join('\n');

describe('there is something to examine', () => {
  it('found the image that builds the console', () => {
    expect(existsSync(DOCKERFILE_PATH)).toBe(true);
    expect(BUILD_BODY.length).toBeGreaterThan(400);
  });
});

describe('the Prisma client exists before the bundle that traces it', () => {
  it('runs the generate step at all', () => {
    expect(BUILD_BODY).toContain('prisma:generate');
  });

  it('🛑 runs it BEFORE the Studio build', () => {
    const generated = BUILD_BODY.indexOf('prisma:generate');
    const built = BUILD_BODY.indexOf('@age/studio build');

    expect(generated).toBeGreaterThan(-1);
    expect(built).toBeGreaterThan(-1);
    expect(generated).toBeLessThan(built);
  });

  it('installs before it generates, in the same image', () => {
    // ⚠️ In a script the three steps shared one ssh invocation so a re-run
    // could not do only the last. A Dockerfile gives that for free — the layers
    // are ordered and cached together — but the INSTALL must still precede the
    // generate, or the generate runs without the Prisma CLI at all.
    const installed = BUILD_BODY.indexOf('pnpm install --frozen-lockfile');

    expect(installed).toBeGreaterThan(-1);
    expect(installed).toBeLessThan(BUILD_BODY.indexOf('prisma:generate'));
  });

  it('🚫 does not leave a second, unordered copy of the sequence in the deploy script', () => {
    // 🛑 TWO PLACES THAT BUILD IS HOW ONE OF THEM QUIETLY LOSES THE ORDER. The
    // script now delegates the build to the image; it must not run its own.
    const script = readFileSync(join(REPO, 'scripts', 'deploy-studio.sh'), 'utf8')
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n');

    expect(script).not.toContain('@age/studio build');
  });
});
