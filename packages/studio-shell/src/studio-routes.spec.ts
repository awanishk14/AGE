import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { STUDIO_AREAS } from './navigation';

/**
 * Every declared area must have a page, and every page must have a declared
 * area.
 *
 * ⚠️ The second direction is the one that matters: a route file with no area
 * behind it is a screen nobody declared, with no question, no wiring state and
 * no reason recorded for what it shows.
 */

const appDir = fileURLToPath(new URL('../../../apps/studio/src/app/', import.meta.url));

const pageFor = (route: string): string =>
  `${appDir}${route === '/' ? '' : `${route.slice(1)}/`}page.tsx`;

describe('AGE Studio routes', () => {
  it('has areas to check', () => {
    expect(STUDIO_AREAS.length).toBeGreaterThan(10);
  });

  it('renders a page for every declared area', () => {
    let checked = 0;
    for (const area of STUDIO_AREAS) {
      expect(existsSync(pageFor(area.route)), `${area.route} has no page.tsx`).toBe(true);
      checked += 1;
    }
    expect(checked).toBe(STUDIO_AREAS.length);
  });

  it('has no page for a refused area', () => {
    for (const route of ['/organizations', '/administration', '/settings', '/knowledge']) {
      expect(existsSync(pageFor(route)), `${route} must not exist`).toBe(false);
    }
  });
});
