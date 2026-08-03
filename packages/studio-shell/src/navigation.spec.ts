import { describe, expect, it } from 'vitest';

import {
  areaByRoute,
  areasForLevel,
  everyAreaIsUnwired,
  REFUSED_AREAS,
  STUDIO_AREAS,
} from './navigation';

describe('STUDIO_AREAS', () => {
  it('declares areas', () => {
    // ⚠️ Assert the set is non-empty FIRST, so an emptied model can never make
    // every rule below vacuously pass.
    expect(STUDIO_AREAS.length).toBeGreaterThan(10);
  });

  it('has unique ids and unique routes', () => {
    expect(new Set(STUDIO_AREAS.map((a) => a.id)).size).toBe(STUDIO_AREAS.length);
    expect(new Set(STUDIO_AREAS.map((a) => a.route)).size).toBe(STUDIO_AREAS.length);
  });

  it('gives every area a label, a route and a question', () => {
    let checked = 0;
    for (const area of STUDIO_AREAS) {
      expect(area.label.trim()).not.toBe('');
      expect(area.route.startsWith('/')).toBe(true);
      expect(area.question.trim()).not.toBe('');
      checked += 1;
    }
    expect(checked).toBe(STUDIO_AREAS.length);
  });

  /**
   * 🚫 The rule that keeps the shell honest. An area that cannot render a real
   * result must say why, in words the operator can act on. An unexplained empty
   * screen is indistinguishable from a business about which AGE knows nothing —
   * the absence-looks-like-presence failure `17_DESIGN_SYSTEM.md` §0.1 forbids.
   */
  it('explains every not-wired area', () => {
    const unwired = STUDIO_AREAS.filter((a) => a.wiring === 'not-wired');
    expect(unwired.length).toBeGreaterThan(0);
    for (const area of unwired) {
      expect(area.notWiredBecause, `${area.id} must explain why it is not wired`).toBeDefined();
      expect((area.notWiredBecause ?? '').length).toBeGreaterThan(20);
    }
  });

  /**
   * ⚠️ The honest state of this slice. When an area is genuinely wired this test
   * is expected to be updated — but it must be updated because something was
   * wired, 🚫 never to make a screen look finished.
   */
  it('reports that nothing is wired yet', () => {
    expect(everyAreaIsUnwired()).toBe(true);
  });

  /**
   * 🚫 `OX_02` §2 refuses Organizations, Administration and Settings as
   * navigation areas, and defers Knowledge (gap G-11). None may appear here.
   * ⚠️ Organizations especially: `organizationId` is read off a `ClientRecord`
   * and is never typed — a navigation level invites fabricated scope.
   */
  it('contains none of the refused or deferred areas', () => {
    const ids = STUDIO_AREAS.map((a) => a.id);
    const labels = STUDIO_AREAS.map((a) => a.label.toLowerCase());
    for (const refused of REFUSED_AREAS) {
      expect(ids).not.toContain(refused);
      expect(labels).not.toContain(refused);
    }
    expect(REFUSED_AREAS.length).toBe(4);
  });

  /** S7 Contradictions and S13 Diagnostics are areas in their own right. */
  it('keeps Contradictions and Diagnostics as first-class areas', () => {
    expect(areaByRoute('/contradictions')?.screen).toBe('S7');
    expect(areaByRoute('/diagnostics')?.screen).toBe('S13');
  });

  it('maps every area to a distinct OX_01 screen id', () => {
    const screens = STUDIO_AREAS.map((a) => a.screen);
    expect(new Set(screens).size).toBe(screens.length);
    for (const screen of screens) {
      expect(screen).toMatch(/^S\d+$/);
    }
  });

  it('is frozen, so navigation cannot be mutated at runtime', () => {
    expect(Object.isFrozen(STUDIO_AREAS)).toBe(true);
    expect(Object.isFrozen(REFUSED_AREAS)).toBe(true);
  });
});

describe('areasForLevel', () => {
  it('partitions the areas across the three levels with none left over', () => {
    const console_ = areasForLevel('console');
    const business = areasForLevel('business');
    const subject = areasForLevel('subject');
    expect(console_.length + business.length + subject.length).toBe(STUDIO_AREAS.length);
    expect(console_.length).toBeGreaterThan(0);
    expect(business.length).toBeGreaterThan(0);
    expect(subject.length).toBeGreaterThan(0);
  });

  it('puts Businesses at the business level and Diagnostics at the console level', () => {
    expect(areasForLevel('business').map((a) => a.id)).toContain('businesses');
    expect(areasForLevel('console').map((a) => a.id)).toContain('diagnostics');
  });
});

describe('areaByRoute', () => {
  it('resolves a known route', () => {
    expect(areaByRoute('/bif')?.id).toBe('bif');
  });

  it('returns undefined for an unknown route rather than a fallback area', () => {
    expect(areaByRoute('/organizations')).toBeUndefined();
    expect(areaByRoute('/nope')).toBeUndefined();
  });
});
