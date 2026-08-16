import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * ⚠️ THIS EXISTS BECAUSE THE BROWSER TOLD US, 🚫 NOT BECAUSE A LINTER DID.
 *
 * The acceptance walkthrough of the published console asked for "no console
 * errors", and every page load produced exactly one: a `404` on
 * `/favicon.ico`, because `apps/studio` shipped no icon of any kind.
 *
 * 🛑 A CONSOLE THAT PRINTS A ROUTINE ERROR TEACHES ITS OPERATOR TO IGNORE
 * ERRORS. That is the whole reason to fix a cosmetic 404 on a product whose
 * argument is that it says only what it can support: the next error in that
 * pane is the one nobody reads.
 *
 * 🚫 This does not assert what the icon LOOKS like — that is design, and a test
 * that pinned the artwork would fail on every legitimate redraw. It asserts the
 * file is present, is really an SVG, and that exactly one icon claims the
 * route, since Next resolves `icon.*` by convention and two candidates make
 * "which icon is served" have two answers.
 */
describe('the console ships an icon, so a routine 404 stops training the operator to ignore errors', () => {
  const appDirectory = __dirname;

  it('serves an icon from the app route convention', () => {
    const iconPath = join(appDirectory, 'icon.svg');

    expect(existsSync(iconPath)).toBe(true);

    const markup = readFileSync(iconPath, 'utf8');

    expect(markup).toContain('<svg');
    expect(markup).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('has exactly one icon candidate, so the served icon has exactly one answer', () => {
    const candidates = readdirSync(appDirectory).filter((name) =>
      /^(icon|apple-icon|favicon)\.[a-z0-9]+$/i.test(name),
    );

    // ⚠️ Assert the scan found something before asserting what it found — an
    // empty read of the wrong directory would otherwise report compliance.
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates).toEqual(['icon.svg']);
  });
});
