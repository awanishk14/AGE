import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **THE SERVER-ACTION CONTRACT** — ADR-0074 §7 slice 3.
 *
 * 🛑 **A `'use server'` FUNCTION IS A BROWSER-REACHABLE ENDPOINT.** The route
 * contract next door protects PAGES; it says nothing about the actions those
 * pages hand to the browser. Next.js gives every exported action a stable id and
 * a POST route of its own, so *"the screen is already behind the boundary"* is
 * 🚫 not a reason for the action to skip its own check — the screen is not what
 * is being called.
 *
 * ⚠️ **THIS WAS A REAL, UNRECORDED GAP, NOT A PRECAUTION.** Before slice 3 every
 * action in this directory ran with no session check whatsoever:
 * `generateBifAction` read the operator's answer file for any `clientId` a
 * caller cared to POST.
 *
 * 🛑 **AND IT ASSERTS THE ORDER, NOT MERELY THE PRESENCE** — an action that
 * calls the boundary after doing the work has already done the work.
 *
 * ⚠️ **THE WALK IS ASSERTED TO HAVE FOUND FILES**, and every action file is
 * listed by hand: a new action file that nobody classified is a set of endpoints
 * nobody protected. 🚫 Do not "fix" a failure here by globbing.
 */

const SERVER_ROOT = resolve(process.cwd(), 'src', 'server');

/** Every file whose exports the browser can call. */
const ACTION_FILES: readonly string[] = [
  'bif-actions.ts',
  'client-actions.ts',
  'contradictions-actions.ts',
  'derived-intelligence-actions.ts',
  'discovery-actions.ts',
  'evidence-actions.ts',
  'intelligence-actions.ts',
  'peer-products-actions.ts',
  'snapshot-actions.ts',
  'sources-actions.ts',
];

/** ⚠️ A file's own explanation of a rule must not be mistaken for the rule. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * 🛑 **SLICE 4 NARROWED THIS GUARD; it did 🚫 NOT relax it.** The rule used to
 * be *"every action establishes a verified session"*. It is now *"every action
 * establishes a SCOPE"* - strictly more, because `requireScopedAccess` calls the
 * session boundary itself and then names a capability and a subject on top.
 *
 * ⚠️ An action reverting to the bare session boundary would still be admitted,
 * still work, and still pass the OLD rule - which is exactly why the old string
 * is asserted ABSENT rather than merely no longer required.
 */
const GUARD = 'await requireScopedAccess(';
const BYPASSED_GUARD = 'requireVerifiedSession';

describe('the studio server-action contract', () => {
  const found = readdirSync(SERVER_ROOT).filter(
    (name) => name.endsWith('-actions.ts') && !name.endsWith('.test.ts'),
  );

  it('finds action files at all, so an empty scan can never report compliance', () => {
    expect(found.length).toBeGreaterThan(0);
    expect(found.length).toBe(ACTION_FILES.length);
  });

  it('classifies every action file', () => {
    expect(
      found.filter((name) => !ACTION_FILES.includes(name)),
      'An action file nobody listed is a set of endpoints nobody protected. Add it to ' +
        'ACTION_FILES in action-protection.test.ts.',
    ).toEqual([]);
  });

  describe.each(ACTION_FILES)('%s', (name) => {
    const raw = readFileSync(join(SERVER_ROOT, name), 'utf8');
    const source = stripComments(raw);

    it("is a 'use server' file, so the rule below is the right rule for it", () => {
      expect(source).toContain("'use server'");
    });

    it('reaches the session boundary only through the scope boundary', () => {
      expect(
        source,
        `${name} calls the session boundary directly. Slice 4 composes the scope ON TOP of it; ` +
          `an action that stops at the session has been admitted but never authorized.`,
      ).not.toContain(BYPASSED_GUARD);
    });

    it('establishes a SCOPE in EVERY exported action, naming a capability', () => {
      const bodies = [...source.matchAll(/export async function (\w+)\(/g)];
      expect(bodies.length).toBeGreaterThan(0);

      for (const [, actionName] of bodies) {
        const start = source.indexOf(`export async function ${actionName}(`);
        const next = source.indexOf('export ', start + 1);
        const body = source.slice(start, next === -1 ? source.length : next);

        expect(
          body,
          `${name}: ${actionName} does not call the scope boundary. A server action is an ` +
            `endpoint; the page that renders its button does not protect it.`,
        ).toContain(GUARD);

        // 🛑 THE CAPABILITY IS A LITERAL AT THE CALL SITE, 🚫 NEVER A VARIABLE.
        // A capability computed from an argument is the caller choosing its own
        // permission, which is AGE-INV-SEL-1 wearing a different hat.
        expect(
          body,
          `${name}: ${actionName} does not name a capability literal. A capability read from a ` +
            `variable is the caller choosing what it is allowed to do.`,
        ).toMatch(/requireScopedAccess\(\s*'[a-z]+\.[a-z]+'\s*,/);
      }
    });

    it('establishes it BEFORE any effect-module call', () => {
      const guardAt = source.indexOf(GUARD);
      expect(guardAt).toBeGreaterThan(-1);

      const imported = [
        ...source.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*'\.\/operator-environment'/g),
      ]
        .flatMap(([, names]) => (names ?? '').split(','))
        .map((entry) => entry.trim())
        // 🚫 Types are not calls. Only the value imports can read anything.
        .filter((entry) => entry !== '' && !entry.startsWith('type '));

      let examined = 0;

      for (const symbol of imported) {
        const callAt = source.indexOf(`${symbol}(`);
        if (callAt === -1) continue;

        examined += 1;
        expect(
          callAt,
          `${name} calls ${symbol}() before the session boundary. An action that acts before it ` +
            `admits has already acted.`,
        ).toBeGreaterThan(guardAt);
      }

      // ⚠️ Count what was examined, so the loop above can never pass silently.
      expect(examined).toBe(imported.filter((symbol) => source.includes(`${symbol}(`)).length);
    });

    it('takes the organization from the session row, never from an argument', () => {
      // 🛑 AGE-INV-SEL-1. An action that accepted an `entitledOrganizationId`
      // parameter would let the caller name whose data it wants — the exact
      // chain the invariant forbids. The `clientId` parameter is fine: it is a
      // filter applied INSIDE the entitlement.
      expect(
        source,
        `${name} accepts an organization as an argument. The entitlement is the session's, and ` +
          `a caller must never be able to state it.`,
      ).not.toMatch(/export async function[\s\S]*?entitledOrganizationId:\s*string/);

      if (source.includes('session.organizationId')) {
        expect(source).toContain('const { session } = await requireScopedAccess(');
      }
    });
  });
});
