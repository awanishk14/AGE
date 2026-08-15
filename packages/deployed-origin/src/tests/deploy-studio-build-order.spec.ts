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

const REPO = join(__dirname, '..', '..', '..', '..');
const SCRIPT_PATH = join(REPO, 'scripts', 'deploy-studio.sh');

const SCRIPT = readFileSync(SCRIPT_PATH, 'utf8');

/** ⚠️ Comments come off first — this file's own explanation names both steps. */
const SCRIPT_BODY = SCRIPT.split('\n')
  .filter((line) => !line.trimStart().startsWith('#'))
  .join('\n');

describe('there is something to examine', () => {
  it('found the deploy script', () => {
    expect(existsSync(SCRIPT_PATH)).toBe(true);
    expect(SCRIPT_BODY.length).toBeGreaterThan(1000);
  });
});

describe('the Prisma client exists before the bundle that traces it', () => {
  it('runs the generate step at all', () => {
    expect(SCRIPT_BODY).toContain('prisma:generate');
  });

  it('🛑 runs it BEFORE the Studio build', () => {
    const generated = SCRIPT_BODY.indexOf('prisma:generate');
    const built = SCRIPT_BODY.indexOf('@age/studio build');

    expect(generated).toBeGreaterThan(-1);
    expect(built).toBeGreaterThan(-1);
    expect(generated).toBeLessThan(built);
  });

  it('does both in the same remote invocation as the install', () => {
    // ⚠️ Split across two ssh calls they would still be ordered — but an
    // operator re-running only the build would silently reintroduce the stub.
    const line = SCRIPT_BODY.split('\n').find((candidate) =>
      candidate.includes('@age/studio build'),
    );

    expect(line).toBeDefined();
    expect(line).toContain('pnpm install --frozen-lockfile');
    expect(line).toContain('prisma:generate');
  });
});
