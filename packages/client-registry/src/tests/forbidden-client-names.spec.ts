import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  containsAnyNameDigest,
  containsForbiddenClientName,
  forbiddenNameDigestOf,
  FORBIDDEN_CLIENT_NAME_DIGESTS,
  normalizeForForbiddenScan,
} from '../forbidden-client-names';

/**
 * ⚠️ EVERY POSITIVE CASE USES AN OBVIOUSLY FICTIONAL NAME. Feeding a real
 * forbidden name to the real list would put it back in the repository, which is
 * the whole thing this module removes — so the MECHANISM is proved against a
 * digest built here, and the real list is checked only for shape.
 */
const FICTIONAL = 'Example Widgets Ltd';
const FICTIONAL_DIGESTS = [forbiddenNameDigestOf(FICTIONAL)];

describe('normalizeForForbiddenScan', () => {
  it('collapses every spelling a name can be written in', () => {
    const spellings = ['Example Widgets Ltd', 'example-widgets-ltd', 'ExampleWidgetsLtd'];
    let examined = 0;
    for (const spelling of spellings) {
      expect(normalizeForForbiddenScan(spelling)).toBe('examplewidgetsltd');
      examined += 1;
    }
    expect(examined).toBe(3);
  });
});

describe('the scan', () => {
  it('finds the name however it is punctuated', () => {
    let examined = 0;
    for (const spelling of ['Example Widgets Ltd', 'example-widgets-ltd', 'EXAMPLEWIDGETSLTD']) {
      expect(containsAnyNameDigest(`prefix ${spelling} suffix`, FICTIONAL_DIGESTS)).toBe(true);
      examined += 1;
    }
    expect(examined).toBe(3);
  });

  it('finds the name buried inside a larger document', () => {
    const document = `${'x'.repeat(4000)} example widgets ltd ${'y'.repeat(4000)}`;
    expect(containsAnyNameDigest(document, FICTIONAL_DIGESTS)).toBe(true);
  });

  /**
   * 🛑 THE NEGATIVE HALF. Without it a scan that always returned true would
   * pass every other test in this file.
   */
  it('does not fire on text that merely resembles the name', () => {
    let examined = 0;
    for (const text of ['example widgets', 'widgets ltd example', 'exampl3 widgets ltd', '']) {
      expect(containsAnyNameDigest(text, FICTIONAL_DIGESTS)).toBe(false);
      examined += 1;
    }
    expect(examined).toBe(4);
  });

  it('does not fire on text shorter than the name', () => {
    expect(containsAnyNameDigest('ex', FICTIONAL_DIGESTS)).toBe(false);
  });

  it('reports only a boolean, so no failure message can carry the name', () => {
    expect(typeof containsAnyNameDigest(FICTIONAL, FICTIONAL_DIGESTS)).toBe('boolean');
  });
});

describe('the committed digest list', () => {
  it('has entries to check', () => {
    expect(FORBIDDEN_CLIENT_NAME_DIGESTS.length).toBeGreaterThan(0);
  });

  it('carries a well-formed digest and a plausible length for every entry', () => {
    let examined = 0;
    for (const entry of FORBIDDEN_CLIENT_NAME_DIGESTS) {
      expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(entry.length).toBeGreaterThan(2);
      examined += 1;
    }
    expect(examined).toBe(FORBIDDEN_CLIENT_NAME_DIGESTS.length);
  });

  /**
   * 🛑 THE POINT OF THE WHOLE SLICE. The module that holds the digests must not
   * hold anything a digest is supposed to replace — including a comment saying
   * which client an entry is for.
   */
  it('spells no forbidden name in the module that lists them', () => {
    const source = readFileSync(join(__dirname, '..', 'forbidden-client-names.ts'), 'utf8');
    expect(source.length).toBeGreaterThan(1000);
    expect(containsForbiddenClientName(source)).toBe(false);
  });

  it('derives a digest the same way the list was built', () => {
    // ⚠️ This is the recipe for adding a client, run against a fictional name.
    const derived = forbiddenNameDigestOf(FICTIONAL);
    expect(derived.length).toBe('examplewidgetsltd'.length);
    expect(derived).toEqual(forbiddenNameDigestOf('example-widgets-ltd'));
  });
});
