import { BIF_SECTIONS, SectionType } from '@age/bif';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { BIF_FIELD_ORIGINS, discoveryFieldPathForBifField } from './bif-field-origins';
import { EVIDENCEABLE_FIELD_PATHS } from './field-provenance';

describe('BIF_FIELD_ORIGINS', () => {
  it('names only canonical BIF field keys, on sections the BIF actually defines', () => {
    // 🚫 A row for a key no BIF section defines would let a surface claim an
    // origin for a field that cannot exist.
    expect(BIF_FIELD_ORIGINS.length).toBeGreaterThan(0);

    for (const origin of BIF_FIELD_ORIGINS) {
      const definition = BIF_SECTIONS.find((section) => section.type === origin.sectionType);
      expect(definition, `no BIF section of type ${origin.sectionType}`).toBeDefined();
      expect(definition?.fields.map((field) => field.key)).toContain(origin.key);
    }
  });

  it('names only field paths that may carry evidence', () => {
    for (const origin of BIF_FIELD_ORIGINS) {
      expect(EVIDENCEABLE_FIELD_PATHS).toContain(origin.fieldPath);
    }
  });

  it('holds at most one row per BIF field', () => {
    const keys = BIF_FIELD_ORIGINS.map((origin) => `${origin.sectionType}::${origin.key}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('answers `undefined` for a BIF field discovery does not feed', () => {
    // ⚠️ A REAL ANSWER, not a miss. 🚫 Never smoothed into the nearest field
    // path, and 🚫 never into a default provenance (ADR-0066 §0.4c).
    expect(discoveryFieldPathForBifField(SectionType.OrganizationIdentity, 'legalName')).toBe(
      'businessName',
    );
    expect(
      discoveryFieldPathForBifField(SectionType.OrganizationIdentity, 'noSuchField'),
    ).toBeUndefined();
    expect(discoveryFieldPathForBifField(SectionType.Kpis, 'legalName')).toBeUndefined();
  });

  /**
   * ⚠️ THE DRIFT GUARD. The mapper must read this table rather than repeat it:
   * two copies of the link mean a surface can say a BIF field came from one
   * discovery field while the mapper applied another field's evidence to it.
   */
  it('🚫 the mapper holds no second copy of the link', () => {
    const source = readFileSync(new URL('./business-discovery-to-bif.ts', import.meta.url), 'utf8');
    const withoutComments = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    const literalFieldPaths = withoutComments.match(/fieldPath:\s*'/g) ?? [];
    expect(literalFieldPaths).toHaveLength(0);

    const routed = withoutComments.match(/fieldPath:\s*originOf\('/g) ?? [];
    expect(routed.length).toBe(BIF_FIELD_ORIGINS.length);
  });
});
