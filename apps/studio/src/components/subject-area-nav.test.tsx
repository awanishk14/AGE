import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { areasForLevel } from '@age/studio-shell';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SubjectAreaNav } from './subject-area-nav';

// ⚠️ Resolved from the package root, not `import.meta.url`: these component
// tests run under jsdom, where `import.meta.url` is not a `file:` URL.
const COMPONENTS_DIR = join(process.cwd(), 'src', 'components');

describe('SubjectAreaNav', () => {
  it('links every subject area except the one being viewed', () => {
    render(<SubjectAreaNav clientId="client-fictional" currentAreaId="discovery" />);

    const subjects = areasForLevel('subject');
    expect(subjects.length).toBeGreaterThan(1);

    for (const area of subjects) {
      const link = screen.queryByRole('link', { name: area.label });
      if (area.id === 'discovery') {
        expect(link, 'the current area must not link to itself').toBeNull();
      } else {
        expect(link, `${area.id} must be reachable`).toBeDefined();
        expect((link as HTMLAnchorElement).getAttribute('href')).toContain('client-fictional');
      }
    }
  });

  /**
   * ⚠️ A link that leads to a screen with no source must say so BEFORE it is
   * followed. The operator's complaint was being stranded; sending them to an
   * empty screen instead is a different way of wasting the same trip.
   */
  it('marks an unwired area on the link rather than after the click', () => {
    render(<SubjectAreaNav clientId="client-fictional" />);

    const unwired = areasForLevel('subject').filter((area) => area.wiring !== 'wired');
    expect(unwired.length).toBeGreaterThan(0);

    const text = document.body.textContent ?? '';
    for (const area of unwired) {
      expect(text).toContain(area.label);
    }
    expect(text).toContain('(not wired)');
  });

  /**
   * 🚫 The areas are not steps. Numbering them, or calling any of them "next",
   * would assert a workflow AGE does not enforce and cannot verify.
   */
  it('states no order and offers no "next"', () => {
    render(<SubjectAreaNav clientId="client-fictional" currentAreaId="bif" />);

    const text = (document.body.textContent ?? '').toLowerCase();
    let checked = 0;
    for (const phrase of [
      'next step',
      'step 1',
      'step 2',
      'continue to',
      'finish',
      'complete the',
    ]) {
      checked += 1;
      expect(text, `the nav must not say "${phrase}"`).not.toContain(phrase);
    }
    expect(checked).toBe(6);
  });
});

/**
 * 🛑 THE GUARD THAT KEEPS THE DEFECT FIXED. Every subject screen was reachable
 * only from `/businesses`, and the five WIRED screens were the ones missing a
 * way out. A new subject screen must not be able to ship stranded again.
 */
describe('every subject screen offers a way out', () => {
  it('renders the shared nav in each subject screen module', () => {
    const screens = readdirSync(COMPONENTS_DIR).filter(
      (name) => name.endsWith('-screen.tsx') && !name.endsWith('.test.tsx'),
    );

    // ⚠️ The walk must prove it found files, or an empty scan reports success.
    expect(screens.length).toBeGreaterThanOrEqual(6);

    const subjectIds = new Set(areasForLevel('subject').map((area) => area.id));
    let inspected = 0;

    for (const name of screens) {
      const areaId = name.replace('-screen.tsx', '');
      // `businesses`/`dashboard` are console-level; `subject-area` is the shared
      // placeholder and is checked by name below.
      if (!subjectIds.has(areaId) && areaId !== 'subject-area') {
        continue;
      }

      inspected += 1;
      const source = readFileSync(join(COMPONENTS_DIR, name), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');

      expect(source, `${name} must render SubjectAreaNav`).toContain('<SubjectAreaNav');
    }

    // ⚠️ Counted after the loop: the per-file count is not uniform, and a
    // `continue` that swallowed every screen would otherwise pass silently.
    expect(inspected).toBeGreaterThanOrEqual(6);
  });

  /**
   * ⚠️ ONE IMPLEMENTATION of the "way out of this screen" nav. A subject screen
   * that hand-rolls its own copy is a second truth about which areas exist, and
   * the copy that drifts still passes its own tests.
   *
   * ⚠️ Scoped to SUBJECT screens on purpose. `businesses-screen.tsx` also calls
   * `areasForLevel('subject')`, and legitimately: it lists the areas under each
   * business in a list of many businesses. That is a different surface with a
   * different question, 🚫 not a duplicate of this nav.
   */
  it('has exactly one implementation of the subject-screen area nav', () => {
    const subjectIds = new Set(areasForLevel('subject').map((area) => area.id));
    const screens = readdirSync(COMPONENTS_DIR).filter(
      (name) =>
        name.endsWith('-screen.tsx') &&
        !name.endsWith('.test.tsx') &&
        (subjectIds.has(name.replace('-screen.tsx', '')) || name === 'subject-area-screen.tsx'),
    );
    expect(screens.length).toBeGreaterThanOrEqual(6);

    let inspected = 0;
    for (const name of screens) {
      inspected += 1;
      const source = readFileSync(join(COMPONENTS_DIR, name), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');

      expect(source, `${name} must not build its own subject area list`).not.toContain(
        "areasForLevel('subject')",
      );
    }
    expect(inspected).toBe(screens.length);
  });
});
