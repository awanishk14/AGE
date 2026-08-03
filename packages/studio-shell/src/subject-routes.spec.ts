import { describe, expect, it } from 'vitest';

import {
  areaHref,
  areaNeedsClientId,
  areasForLevel,
  matchAreaRoute,
  MissingClientScopeError,
  REFUSED_AREAS,
  STUDIO_AREAS,
} from './navigation';

describe('subject routes carry the business in the path', () => {
  it('has subject areas to check', () => {
    expect(areasForLevel('subject').length).toBeGreaterThan(5);
  });

  it('scopes EVERY subject area to a clientId', () => {
    let checked = 0;
    for (const area of areasForLevel('subject')) {
      expect(area.route, `${area.id} is not scoped`).toMatch(/^\/b\/:clientId\//);
      expect(areaNeedsClientId(area)).toBe(true);
      checked += 1;
    }
    expect(checked).toBe(areasForLevel('subject').length);
  });

  it('scopes NO console or business area to a clientId', () => {
    for (const area of [...areasForLevel('console'), ...areasForLevel('business')]) {
      expect(areaNeedsClientId(area), `${area.id} must not be scoped`).toBe(false);
    }
  });

  it('has no route naming an organization', () => {
    // 🚫 There is no organization level, no organization route and no
    // organization anyone can type (ADR-0058 D4, ADR-0054 D2). The band on S2
    // is DERIVED from resolved records.
    for (const area of STUDIO_AREAS) {
      expect(area.route.toLowerCase()).not.toContain('organization');
      expect(area.route.toLowerCase()).not.toContain(':orgid');
    }
    expect(REFUSED_AREAS).toContain('organizations');
  });
});

describe('areaHref', () => {
  const discovery = STUDIO_AREAS.find((area) => area.id === 'discovery');
  const businesses = STUDIO_AREAS.find((area) => area.id === 'businesses');

  it('substitutes the business into a subject route', () => {
    expect(areaHref(discovery!, 'acme-1')).toBe('/b/acme-1/discovery');
  });

  it('encodes a clientId that would otherwise change the path', () => {
    expect(areaHref(discovery!, 'a/b')).toBe('/b/a%2Fb/discovery');
  });

  it('returns unscoped routes unchanged', () => {
    expect(areaHref(businesses!)).toBe('/businesses');
    expect(areaHref(businesses!, 'acme-1')).toBe('/businesses');
  });

  it.each([[undefined], [''], ['   ']])(
    'REFUSES a subject route with no business (%j)',
    (clientId) => {
      // 🚫 No fallback, no "first business", no "last selected". A scope the
      // operator did not choose is not a default, it is an invention.
      expect(() => areaHref(discovery!, clientId)).toThrow(MissingClientScopeError);
    },
  );

  it('names the area in the refusal', () => {
    expect(() => areaHref(discovery!)).toThrow(/"discovery"/);
  });
});

describe('matchAreaRoute', () => {
  it('resolves a scoped path back to its area and business', () => {
    expect(matchAreaRoute('/b/acme-1/bif')).toEqual({
      area: STUDIO_AREAS.find((area) => area.id === 'bif'),
      clientId: 'acme-1',
    });
  });

  it('decodes the business back out of the path', () => {
    expect(matchAreaRoute('/b/a%2Fb/discovery')?.clientId).toBe('a/b');
  });

  it('resolves unscoped areas with no business', () => {
    const matched = matchAreaRoute('/businesses');

    expect(matched?.area.id).toBe('businesses');
    expect(matched?.clientId).toBeUndefined();
  });

  it('round-trips every subject area', () => {
    let checked = 0;
    for (const area of areasForLevel('subject')) {
      expect(matchAreaRoute(areaHref(area, 'acme-1'))).toEqual({ area, clientId: 'acme-1' });
      checked += 1;
    }
    expect(checked).toBe(areasForLevel('subject').length);
  });

  it.each([
    ['/b//discovery'],
    ['/b/acme-1'],
    ['/b/acme-1/nonsense'],
    ['/b/acme-1/discovery/extra'],
    ['/nonsense'],
    ['/discovery'],
    ['/organizations'],
  ])('returns undefined for %s rather than a nearest match', (pathname) => {
    // 🚫 No redirect to a plausible screen. An unknown route is an unknown route.
    expect(matchAreaRoute(pathname)).toBeUndefined();
  });
});
