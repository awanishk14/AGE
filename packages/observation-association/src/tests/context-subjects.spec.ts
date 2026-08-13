import { BIFStatus, FieldConfidence, FieldSource, FieldType, SectionType } from '@age/bif';
import type {
  ScoredBifContext,
  ScoredBifContextField,
  ScoredBifContextSection,
} from '@age/business-discovery-contracts';
import { describe, expect, it } from 'vitest';

import { SUBJECT_SOURCES, deriveModelledSubjects } from '../context-subjects';

/**
 * ⚠️ OBVIOUSLY FICTIONAL, and that is the guard (ADR-0053 D3, ADR-0065 D1).
 * 🚫 Do not "make the fixtures more realistic".
 */
const field = (key: string, value: unknown, type = FieldType.Array): ScoredBifContextField => ({
  key,
  value,
  type,
  required: false,
  source: FieldSource.USER,
  confidence: FieldConfidence.USER_CONFIRMED,
});

const section = (
  type: SectionType,
  fields: readonly ScoredBifContextField[],
): ScoredBifContextSection => ({
  id: `section-${type}`,
  type,
  name: type,
  confidenceScore: 50,
  completenessScore: 50,
  fields,
});

const contextOf = (sections: readonly ScoredBifContextSection[]): ScoredBifContext => ({
  contextVersion: '1.0.0',
  bifId: 'bif-fictional-1',
  bifStatus: BIFStatus.Draft,
  bifConfidenceScore: 63,
  bifCompletenessScore: 12,
  sections,
  omittedSections: [],
  warnings: [],
  reasons: [],
  metadata: {
    presentSectionCount: sections.length,
    omittedSectionCount: 12 - sections.length,
    canonicalSectionCount: 12,
    populatedFieldCount: sections.flatMap((each) => each.fields).length,
  },
});

const POPULATED = contextOf([
  section(SectionType.ProductsServices, [
    field('products', [
      { id: 'offering-fictional-1', name: 'Widget Polishing', type: 'service' },
      { id: 'offering-fictional-2', name: 'Widget Repair', type: 'service' },
    ]),
  ]),
  section(SectionType.IcpPersonas, [
    field('idealCustomerProfiles', [{ id: 'segment-fictional-1', name: 'Regional Widget Owners' }]),
  ]),
  section(SectionType.OrganizationIdentity, [
    field('operatingCountries', ['Atlantis', 'Ruritania']),
  ]),
  section(SectionType.VisionStrategy, [field('longTermGoals', ['Polish twice as many widgets'])]),
]);

const kindOf = (context: ScoredBifContext, subjectKind: string) => {
  const kind = deriveModelledSubjects(context).kinds.find(
    (each) => each.subjectKind === subjectKind,
  );
  if (kind === undefined) throw new Error(`no derivation for ${subjectKind}`);
  return kind;
};

describe('subjects are TRANSCRIBED from the BIF', () => {
  it('reads a service label from the offering the business named', () => {
    expect(kindOf(POPULATED, 'service').subjects).toEqual([
      { subjectKind: 'service', label: 'Widget Polishing' },
      { subjectKind: 'service', label: 'Widget Repair' },
    ]);
  });

  it('reads plain strings and named objects, and nothing else', () => {
    expect(kindOf(POPULATED, 'geography').subjects).toEqual([
      { subjectKind: 'geography', label: 'Atlantis' },
      { subjectKind: 'geography', label: 'Ruritania' },
    ]);
    expect(kindOf(POPULATED, 'audience').subjects).toEqual([
      { subjectKind: 'audience', label: 'Regional Widget Owners' },
    ]);
    expect(kindOf(POPULATED, 'priority').subjects).toEqual([
      { subjectKind: 'priority', label: 'Polish twice as many widgets' },
    ]);
  });

  it('🚫 never stringifies an entry it cannot read — it COUNTS it', () => {
    const kind = kindOf(
      contextOf([section(SectionType.ProductsServices, [field('products', [42, {}, null])])]),
      'service',
    );

    expect(kind.subjects).toEqual([]);
    expect(kind.readings[0]).toEqual({
      source: { section: SectionType.ProductsServices, fieldKey: 'products' },
      state: 'read',
      labelCount: 0,
      unreadableEntryCount: 3,
    });
    expect(JSON.stringify(kind)).not.toContain('[object Object]');
  });

  it('🚫 does not invent a subject from a blank label', () => {
    expect(
      kindOf(
        contextOf([
          section(SectionType.OrganizationIdentity, [field('operatingCountries', ['  '])]),
        ]),
        'geography',
      ).subjects,
    ).toEqual([]);
  });

  it('deduplicates by AGE’s own matching rule, keeping the first spelling', () => {
    expect(
      kindOf(
        contextOf([
          section(SectionType.OrganizationIdentity, [
            field('operatingCountries', ['Atlantis', ' atlantis ']),
          ]),
        ]),
        'geography',
      ).subjects,
    ).toEqual([{ subjectKind: 'geography', label: 'Atlantis' }]);
  });
});

describe('🛑 “never looked” and “looked and holds nothing” stay APART', () => {
  it('reports `never-captured` when every source section is absent', () => {
    const kind = kindOf(POPULATED, 'constraint');

    expect(kind.state).toBe('never-captured');
    expect(kind.readings.map((reading) => reading.state)).toEqual([
      'section-absent',
      'section-absent',
      'section-absent',
    ]);
  });

  it('reports `captured-nothing-recorded` when the section IS present but the field is not', () => {
    const kind = kindOf(
      contextOf([section(SectionType.ProductsServices, [field('somethingElse', ['x'])])]),
      'service',
    );

    expect(kind.state).toBe('captured-nothing-recorded');
    expect(kind.readings[0]?.state).toBe('field-absent');
  });

  it('reports `captured-nothing-recorded` when the field is present and empty', () => {
    expect(
      kindOf(contextOf([section(SectionType.ProductsServices, [field('products', [])])]), 'service')
        .state,
    ).toBe('captured-nothing-recorded');
  });

  it('🛑 one present source is enough to mean AGE DID look', () => {
    // ⚠️ `personas` is absent while `idealCustomerProfiles` is an empty list:
    // AGE captured the section, so 🚫 this must not read as "never looked".
    expect(
      kindOf(
        contextOf([section(SectionType.IcpPersonas, [field('idealCustomerProfiles', [])])]),
        'audience',
      ).state,
    ).toBe('captured-nothing-recorded');
  });

  it('🚫 never omits a kind for having no subjects', () => {
    expect(deriveModelledSubjects(contextOf([])).kinds.map((kind) => kind.subjectKind)).toEqual([
      'service',
      'audience',
      'geography',
      'priority',
      'constraint',
    ]);
  });

  it('🚫 an empty BIF is `never-captured` everywhere, and 🚫 never “none”', () => {
    const derivation = deriveModelledSubjects(contextOf([]));

    expect(derivation.subjects).toEqual([]);
    expect(derivation.kinds.every((kind) => kind.state === 'never-captured')).toBe(true);
  });
});

describe('🚫 the mapping is literal, and reads nothing else', () => {
  it('names every source it consults', () => {
    expect(SUBJECT_SOURCES.service).toEqual([
      { section: SectionType.ProductsServices, fieldKey: 'products' },
    ]);
    expect(SUBJECT_SOURCES.constraint.map((source) => source.section)).toEqual([
      SectionType.Constraints,
      SectionType.Constraints,
      SectionType.Constraints,
    ]);
  });

  it('🛑 SUBJECT_SOURCES spans exactly one section per kind', () => {
    // ⚠️ A TRIPWIRE, 🚫 not a preference. While it holds, `never-captured`'s
    // `every` and a wrong `some` are indistinguishable and no test can catch the
    // difference. The first kind that reads two sections makes that branch real
    // — 🚫 do not delete this guard to make it pass; write the case that tells
    // "AGE never looked" apart from "AGE looked in one place of two".
    for (const [subjectKind, sources] of Object.entries(SUBJECT_SOURCES)) {
      expect(new Set(sources.map((source) => source.section)).size, subjectKind).toBe(1);
    }
  });

  it('🚫 does not read a label out of a section it was not told to read', () => {
    // A service name sitting in a section the table does not name stays invisible.
    expect(
      kindOf(
        contextOf([section(SectionType.BrandSystem, [field('products', ['Widget Polishing'])])]),
        'service',
      ).subjects,
    ).toEqual([]);
  });

  it('🚫 reads no score, and 🚫 mutates nothing', () => {
    const before = JSON.stringify(POPULATED);
    const derivation = deriveModelledSubjects(POPULATED);

    expect(JSON.stringify(POPULATED)).toBe(before);
    const serialised = JSON.stringify(derivation);
    expect(serialised).not.toContain('completenessScore');
    expect(serialised).not.toContain('confidenceScore');
    expect(serialised).not.toContain('bifStatus');
  });
});
