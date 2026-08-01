import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { FICTIONAL_CLIENT_RECORDS, FICTIONAL_MARKER } from '../fixtures/fictional-clients';

/**
 * ADR-0053 D3 — real client records are NEVER committed. The repo is PUBLIC.
 *
 * ⚠️ This guard is the control, not the absence of a real id today. Absence is
 * a fact about the present; the guard is what makes it a property. It fails if
 * the committed fixtures ever stop being obviously fictional — including via
 * the tempting change of "making the demo more realistic".
 */

const FIXTURE = join(__dirname, '..', 'fixtures', 'fictional-clients.ts');

describe('committed client fixtures stay obviously fictional', () => {
  it('has fixtures to check', () => {
    expect(FICTIONAL_CLIENT_RECORDS.length).toBeGreaterThan(0);
  });

  it('marks every id and every external ref as an example', () => {
    let examined = 0;
    for (const record of FICTIONAL_CLIENT_RECORDS) {
      for (const value of [
        record.clientId,
        record.organizationId,
        ...Object.values(record.externalRefs),
      ]) {
        examined += 1;
        expect(value).toContain(FICTIONAL_MARKER);
      }
    }
    expect(examined).toBeGreaterThan(0);
  });

  it('labels every display name as fictional to a human reader', () => {
    for (const record of FICTIONAL_CLIENT_RECORDS) {
      expect(record.displayName.toLowerCase()).toContain('fictional');
    }
  });

  it('names no real client of the operator', () => {
    // 🚫 Not even redacted or masked: a masked ad-account id is still an
    // assertion about who the operator's clients are.
    const source = readFileSync(FIXTURE, 'utf8').toLowerCase();
    const serialized = JSON.stringify(FICTIONAL_CLIENT_RECORDS).toLowerCase();
    for (const forbidden of ['vtest', 'doctor at door', 'doctor-at-door', 'doctoratdoor']) {
      expect(serialized).not.toContain(forbidden);
      expect(source).not.toContain(forbidden);
    }
  });

  it('carries no value that looks like a real Google Ads or Meta account id', () => {
    // Real Google Ads customer ids are 10 digits; Meta act ids are long digit
    // runs. A committed fixture must never contain a plausible one.
    for (const record of FICTIONAL_CLIENT_RECORDS) {
      for (const value of Object.values(record.externalRefs)) {
        expect(value.replace(/\D/g, '')).not.toMatch(/[1-9]\d{8,}/);
      }
    }
  });
});
