import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **THE ROUTE CONTRACT** — ADR-0074 §7 slice 2.
 *
 * 🛑 **THIS TEST FAILS WHEN SOMEBODY ADDS A ROUTE, AND THAT IS ITS ENTIRE
 * POINT.** The dangerous failure for a console is not a broken gate; it is a new
 * screen nobody remembered to put behind one. So every route is listed below by
 * hand, in exactly one of two sets, and a route in neither is a failure with the
 * path in the message. 🚫 Do not "fix" it by globbing — the manual list IS the
 * classification.
 *
 * 🛑 **AND IT ASSERTS THE ORDER, NOT MERELY THE PRESENCE.** A page that calls
 * the guard AFTER reading a client's data has already read the client's data.
 * The Product Owner's words: *"unauthenticated access denied before protected
 * data queries execute"*.
 *
 * ⚠️ **THE WALK IS ASSERTED TO HAVE FOUND FILES.** An empty scan must never be
 * able to report compliance.
 */

// ⚠️ Anchored to the package root, as `effect-isolation.test.ts` is and for the
// same reason: under this vitest config the module URL is not a `file:` URL.
const APP_ROOT = resolve(process.cwd(), 'src', 'app');

/**
 * 🛑 **THE ONLY UNPROTECTED ROUTES, EACH FOR A STATED REASON.** 🚫 Nothing is
 * added here to make a screen work.
 */
const PUBLIC_ROUTES: ReadonlyMap<string, string> = new Map([
  ['sign-in/page.tsx', 'The door itself. It cannot stand behind itself.'],
  [
    'sign-in/start/route.ts',
    'Begins the Google handshake. It mints a `state` and a `nonce` and admits nobody — a ' +
      'session behind it would be a door that requires a session to reach the door.',
  ],
  [
    'sign-in/callback/route.ts',
    'Completes the handshake and IS the boundary check: it verifies the identity, reads the ' +
      'provisioned rows and issues the session. Everything after it is protected by what it did.',
  ],
  [
    'sign-in/landing/page.tsx',
    'The same-site landing hop (ADR-0084 D2). It is reached by the cross-site-initiated redirect ' +
      'out of the callback, on which a `SameSite=Strict` session cookie is WITHHELD — so it is ' +
      'anonymous by construction and could not stand behind the boundary even if it wanted to. ' +
      'It reads nothing, renders nothing, and exists only to perform a same-site navigation to ' +
      '`/`, which is where the boundary actually runs. `landing-hop-isolation.test.ts` enforces ' +
      'all of that; this entry is the classification, not the proof.',
  ],
  [
    'sign-out/route.ts',
    'Ends whatever session the request holds. It performs its own assessment and refuses ' +
      'nothing — an unauthenticated caller signing out is a no-op, never an error.',
  ],
]);

/**
 * Every route that must call a boundary before it touches anything — and 🛑
 * **WHICH** boundary, by name.
 *
 * 🛑 **THERE ARE TWO, AND THE MAP IS HOW A ROUTE SAYS WHICH IT STANDS BEHIND**
 * (ADR-0085). `requireVerifiedSession` returns a TENANT session and is what the
 * sixteen tenant pages need; `requireVerifiedPlatformSession` returns a
 * `VerifiedPlatformSession` — a different type, with no organization on it —
 * and exactly one screen needs that.
 *
 * ⚠️ **THIS WAS A FLAT LIST UNTIL 2026-08-20, AND IT WAS NARROWED RATHER THAN
 * RELAXED.** The old assertion was "contains `await requireVerifiedSession()`".
 * 🚫 The wrong repair would have been to accept either name anywhere, which
 * would let a tenant page stand behind the platform gate and render a
 * organization-less principal's screen. Each route now names ONE, and 🚫 the
 * other is asserted absent.
 */
const PROTECTED_ROUTES: ReadonlyMap<string, string> = new Map(
  [
    'page.tsx',
    'b/[clientId]/bif/page.tsx',
    'b/[clientId]/contradictions/page.tsx',
    'b/[clientId]/discovery/page.tsx',
    'b/[clientId]/evidence/page.tsx',
    'b/[clientId]/execution/page.tsx',
    'b/[clientId]/history/page.tsx',
    'b/[clientId]/intelligence/page.tsx',
    'b/[clientId]/page.tsx',
    'b/[clientId]/peer-products/page.tsx',
    'b/[clientId]/sources/page.tsx',
    'b/[clientId]/strategy/page.tsx',
    'businesses/new/page.tsx',
    'businesses/page.tsx',
    'diagnostics/page.tsx',
  ]
    .map((route) => [route, 'requireVerifiedSession'] as const)
    .concat([
      /**
       * 🛑 **THE PLATFORM ARM — ADR-0085.** These two are reached by a principal
       * that has no organization, so they must 🚫 NOT call the tenant boundary:
       * doing so would send the operator to `/platform`, from `/platform`.
       */
      ['platform/page.tsx', 'requireVerifiedPlatformSession'],
      ['platform/choose/route.ts', 'requireVerifiedPlatformSession'],
    ]),
);

function walkRoutes(directory: string): readonly string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      found.push(...walkRoutes(path));
      continue;
    }

    if (entry.name === 'page.tsx' || entry.name === 'route.ts') {
      found.push(relative(APP_ROOT, path).split('\\').join('/'));
    }
  }

  return found;
}

/** ⚠️ A file's own explanation of a rule must not be mistaken for the rule. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('the studio route contract', () => {
  const routes = walkRoutes(APP_ROOT);

  it('finds routes at all, so an empty scan can never report compliance', () => {
    expect(routes.length).toBeGreaterThanOrEqual(PROTECTED_ROUTES.size + PUBLIC_ROUTES.size);
  });

  it('classifies every route as protected or deliberately public', () => {
    const unclassified = routes.filter(
      (route) => !PUBLIC_ROUTES.has(route) && !PROTECTED_ROUTES.has(route),
    );

    // 🛑 The message names the file, so the failure is a decision to make and
    // not a puzzle to solve.
    expect(
      unclassified,
      `These routes are neither protected nor listed as deliberately public. Classify each one ` +
        `in route-protection.test.ts — a route that nobody classified is a route nobody protected.`,
    ).toEqual([]);
  });

  it('lists no protected route that has since been deleted', () => {
    const missing = [...PROTECTED_ROUTES.keys(), ...PUBLIC_ROUTES.keys()].filter(
      (route) => !routes.includes(route),
    );

    expect(missing).toEqual([]);
  });

  describe.each([...PROTECTED_ROUTES])('%s', (route, boundary) => {
    const source = stripComments(readFileSync(join(APP_ROOT, route), 'utf8'));
    const OTHER_BOUNDARY =
      boundary === 'requireVerifiedSession'
        ? 'requireVerifiedPlatformSession'
        : 'requireVerifiedSession';

    it('calls the boundary it was classified under', () => {
      expect(source).toContain(`await ${boundary}()`);
    });

    /**
     * 🛑 **AND 🚫 NOT THE OTHER ONE.** A tenant page standing behind the
     * platform gate would render for a principal that has no organization; a
     * platform page standing behind the tenant gate would be redirected to
     * itself, forever.
     */
    it('does not also call the other boundary', () => {
      expect(
        source.includes(`${OTHER_BOUNDARY}(`),
        `${route} is classified under ${boundary} and also reaches for ${OTHER_BOUNDARY}. ` +
          `A route stands behind exactly one boundary.`,
      ).toBe(false);
    });

    it('calls the boundary BEFORE any server operation', () => {
      const guardAt = source.indexOf(`await ${boundary}()`);
      expect(guardAt).toBeGreaterThan(-1);

      // Every identifier this route imports from the effect/orchestration
      // modules. 🚫 `session-boundary` itself is excluded — it IS the guard.
      const imported = [...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*'@\/server\/([^']+)'/g)]
        .filter(([, , module]) => module !== 'session-boundary')
        .flatMap(([, names]) => (names ?? '').split(',').map((name) => name.trim()))
        .filter((name) => name !== '');

      let examined = 0;

      for (const name of imported) {
        const callAt = source.indexOf(`${name}(`, guardAt === -1 ? 0 : 0);
        if (callAt === -1) continue;

        examined += 1;
        expect(
          callAt,
          `${route} calls ${name}() before the session boundary. A page that reads before it ` +
            `admits has already read.`,
        ).toBeGreaterThan(guardAt);
      }

      // ⚠️ Count what was examined. A route that imports nothing from
      // `@/server` is legitimate, but the assertion above must not be able to
      // pass silently over a route that imports plenty.
      expect(examined).toBe(imported.filter((name) => source.includes(`${name}(`)).length);
    });
  });
});
