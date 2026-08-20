import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **THE LANDING HOP ASSERTS NOTHING** — ADR-0084 §4 (D2, D3, D4) and §6.2.
 *
 * 🛑 **THE NEW ROUTE IS A NEW SURFACE, AND THIS FILE IS WHY IT IS SAFE TO HAVE
 * ONE.** `/sign-in/landing` exists for exactly one reason: the browser reaches
 * it by a **cross-site-initiated** hop, on which a `SameSite=Strict` session
 * cookie is withheld, so the page is **anonymous by construction**. It then
 * performs a **same-site** navigation to `/`, which does carry the cookie.
 *
 * 🛑 **A PAGE REACHED ANONYMOUSLY THAT TRIED TO BE HELPFUL WOULD BE A SECOND
 * SESSION BOUNDARY**, and the constitution puts that boundary in exactly one
 * place. So this route may not read a cookie, may not read a session, may not
 * read the directory, and may not render one byte of operator, organization or
 * client data. ⚠️ **A guard asserts that, 🚫 not a comment** (ADR-0084 §3,
 * Option B's named cost).
 *
 * ⚠️ **THIS IS A SOURCE-TEXT GUARD, AND THAT IS A REAL LIMIT.** It proves what
 * the files may REACH; 🚫 it does not execute the page. The runtime proof is
 * slice 3, and it is a **browser** — 🚫 not this test, 🚫 not CI.
 *
 * ⚠️ **EVERY SCAN BELOW ASSERTS IT FOUND ITS FILE.** A guard that silently
 * passes over a renamed file is the guard this repo forbids.
 */

const STUDIO_ROOT = resolve(process.cwd(), 'src');

/**
 * 🛑 **THE PATH IS ASSERTED IN ONE PLACE AND COMPARED IN TWO.** If the route
 * moves and the callback is not moved with it, sign-in lands on a 404 — which
 * looks, to the operator, exactly like the defect this ADR exists to fix.
 */
const LANDING_PATH = '/sign-in/landing';

/**
 * ⚠️ **THE NAME WAS CHOSEN SO THAT IT CLAIMS NOTHING.** `/signed-in` was
 * rejected: the route cannot know whether the caller is signed in — it is
 * reached anonymously — and a path that asserts a fact the handler cannot
 * observe is a lie told in a URL bar.
 */
const FILES = Object.freeze({
  landing: resolve(STUDIO_ROOT, 'app', 'sign-in', 'landing', 'page.tsx'),
  handoff: resolve(STUDIO_ROOT, 'components', 'same-site-handoff.tsx'),
  callback: resolve(STUDIO_ROOT, 'app', 'sign-in', 'callback', 'route.ts'),
});

/** ⚠️ A file's own explanation of a rule must not be mistaken for the rule. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function read(path: string): string {
  expect(existsSync(path), `${path} is missing. The landing hop is not optional.`).toBe(true);

  const source = readFileSync(path, 'utf8');

  expect(source.length, `${path} is empty; an empty file passes every scan.`).toBeGreaterThan(0);

  return stripComments(source);
}

describe('the landing hop (ADR-0084 D2/D3)', () => {
  const landing = read(FILES.landing);
  const handoff = read(FILES.handoff);
  const both: readonly (readonly [string, string])[] = [
    ['sign-in/landing/page.tsx', landing],
    ['components/same-site-handoff.tsx', handoff],
  ];

  /**
   * 🛑 **D2 — IT READS NOTHING THAT COULD IDENTIFY A CALLER.** Each of these is
   * a real route into caller state in a Next.js server component, and the page
   * must reach for none of them.
   */
  const FORBIDDEN_READS: readonly (readonly [string, string])[] = [
    [
      'requireVerifiedSession',
      'the session boundary — this route must never stand as a second one',
    ],
    ['next/headers', '`cookies()` and `headers()` live here; both read the caller'],
    ['cookies(', 'reading a cookie is reading the caller'],
    ['headers(', 'reading a header is reading the caller'],
    ['searchParams', 'a query string is caller-controlled input, and this page takes none'],
    ['params', 'this route is not parameterised, and must not become so'],
  ];

  describe.each(both)('%s', (_label, source) => {
    it.each(FORBIDDEN_READS)('does not reach for %s', (needle, why) => {
      expect(source, `The landing hop must not use \`${needle}\`: ${why}.`).not.toContain(needle);
    });

    /**
     * 🛑 **D3 — IT IMPORTS NOTHING THAT COULD CARRY DATA.** 🚫 Not "renders
     * little"; renders none. The import list is the reachability proof: a page
     * that cannot import an effect module cannot render what one returns.
     */
    it('imports nothing from @/server, and nothing from an @age data package', () => {
      const imports = [...source.matchAll(/from\s*'([^']+)'/g)].map(([, from]) => from ?? '');

      expect(
        imports.length,
        'nothing was examined; the import scan found no imports at all',
      ).toBeGreaterThan(0);

      for (const from of imports) {
        expect(
          from.startsWith('@/server'),
          `The landing hop imports '${from}'. A route reached anonymously must not be able to ` +
            `reach an effect module — that is how it stays provably content-free.`,
        ).toBe(false);

        expect(
          from.startsWith('@age/') && from !== '@age/studio-shell',
          `The landing hop imports '${from}'. 🚫 No capability, persistence or session package ` +
            `may be reachable from a page that renders to an unauthenticated caller.`,
        ).toBe(false);
      }
    });
  });

  /**
   * 🛑 **D4 — THE SECOND NAVIGATION IS DELIBERATE AND OBSERVABLE.** A
   * `<meta http-equiv="refresh">` is a race the page cannot observe and the
   * operator cannot see; the ADR names it and rejects it.
   */
  it('navigates by script, to the console root, and replaces rather than pushes', () => {
    expect(
      handoff,
      'The handoff must be a client component. A server component cannot perform the same-site ' +
        'navigation this whole ADR turns on.',
    ).toContain("'use client'");

    // ⚠️ `replace`, 🚫 not `assign`: `assign` leaves the landing hop in session
    // history, so a Back press returns to a page whose only purpose is to leave
    // — and it immediately throws the operator forward again.
    expect(
      handoff,
      'The handoff must navigate with `location.replace`. If this failed because it now uses ' +
        '`location.assign`, that is the defect: `assign` leaves this content-free hop in ' +
        'history and traps Back in a loop.',
    ).toContain('location.replace');

    expect(
      handoff.includes('location.assign'),
      'The handoff uses `location.assign`. Use `location.replace` — see above.',
    ).toBe(false);

    expect(
      handoff.includes('http-equiv'),
      'The handoff uses a `<meta http-equiv="refresh">`. ADR-0084 D4 rejects it by name: it is a ' +
        'race the page cannot observe and the operator cannot see.',
    ).toBe(false);
  });

  it('offers a link that works with no script at all', () => {
    expect(
      handoff,
      'The handoff must always render a real link to `/`. Script is not guaranteed, and the ' +
        'operator must never be stranded on a page whose only purpose is to leave.',
    ).toContain('href="/"');

    // ⚠️ 🚫 The route NEVER guesses whether the script "worked" (D4). It cannot
    // observe that, so it must not branch on it.
    expect(
      handoff.includes('setTimeout'),
      'The handoff uses a timer. ADR-0084 D4: this route never guesses whether the navigation ' +
        'worked — it cannot observe that. The always-present link is the answer, not a delay.',
    ).toBe(false);
  });

  it('renders no state, because it holds none', () => {
    expect(
      handoff.includes('useState'),
      'The handoff holds state. It has nothing to hold: it reads no caller, renders no data, and ' +
        'has exactly one behaviour (D2/D3).',
    ).toBe(false);
  });
});

describe('the callback hands off to the landing hop (ADR-0084 §6.2, D5)', () => {
  const callback = read(FILES.callback);

  it('redirects an ADMITTED caller to the landing hop, not to the console root', () => {
    expect(
      callback,
      `The callback must redirect to ${LANDING_PATH}. Redirecting straight to '/' is the defect ` +
        `ADR-0084 exists to fix: that hop is cross-site-initiated and the Strict cookie is withheld.`,
    ).toContain(`Location: '${LANDING_PATH}'`);

    expect(callback).not.toContain("Location: '/'");
  });

  /**
   * 🛑 **D5 — A REFUSAL DOES NOT ROUTE THROUGH THE LANDING HOP.** A refusal has
   * no session to deliver, so the hop would buy nothing and would put a
   * content-free interstitial between an operator and the sentence that tells
   * them what went wrong.
   */
  it('sends every refusal straight to the sign-in screen', () => {
    expect(callback).toContain('Location: `/sign-in?refused=${marker}`');
    expect(callback).not.toContain(`${LANDING_PATH}?refused=`);
  });

  it('still sets the session cookie on the hop it hands off with', () => {
    // ⚠️ The cookie is set on the 303 exactly as before. 🚫 ADR-0084 changes
    // WHERE the browser is sent, and nothing about what is issued (§5).
    expect(callback).toContain('serializeSessionCookie');
  });
});
