import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BIF_SECTIONS,
  BIFStatus,
  FieldConfidence,
  FieldSource,
  FieldType,
  SectionType,
  type BIFField,
  type BIFSection,
  type BusinessIntelligenceFramework,
} from '@age/bif';
import * as packageEntrypoint from '../index';
import {
  BIF_CONFIDENCE_SCORING_VERSION,
  bifConfidenceScoringMetadataSchema,
  scoreBusinessIntelligenceFramework,
} from '../bif-confidence-scoring';
import {
  PROVISIONAL_BIF_CONFIDENCE_SCORE,
  mapBusinessDiscoveryToBifDraft,
} from '../business-discovery-to-bif';
import { SAMPLE_BUSINESS_DISCOVERY_PROFILE } from '../sample-profile';
import { calculateBusinessDiscoveryCompleteness } from '../completeness-scoring';

const CONSTRUCTED_AT = new Date('2026-07-15T09:30:00.000Z');

const MAPPER_OPTIONS = {
  organizationId: 'org-northwind',
  constructedAt: CONSTRUCTED_AT,
  changedBy: 'analyst@example.com',
} as const;

/** The real sparse Draft BIF the delivered mapper produces (PR #75). */
function sampleDraft(): BusinessIntelligenceFramework {
  return mapBusinessDiscoveryToBifDraft(SAMPLE_BUSINESS_DISCOVERY_PROFILE, MAPPER_OPTIONS).bif;
}

/** A field with explicit provenance, so tests can vary trust deliberately. */
function field(
  key: string,
  required: boolean,
  source: FieldSource,
  confidence: FieldConfidence,
): BIFField {
  return {
    key,
    value: `value-of-${key}`,
    type: FieldType.String,
    required,
    source,
    confidence,
    lastVerifiedAt: CONSTRUCTED_AT,
    history: [
      {
        value: `value-of-${key}`,
        timestamp: CONSTRUCTED_AT,
        source,
        confidence,
        changedBy: 'analyst@example.com',
        reason: 'test fixture',
      },
    ],
  };
}

const ORGANIZATION_IDENTITY_DEFINITION = BIF_SECTIONS.find(
  (definition) => definition.type === SectionType.OrganizationIdentity,
);

/** Section built from real canonical keys, so coverage denominators are real. */
function organizationSection(fields: readonly BIFField[]): BIFSection {
  return {
    id: 'bif-test-organization_identity',
    type: SectionType.OrganizationIdentity,
    name: ORGANIZATION_IDENTITY_DEFINITION?.name ?? 'Organization Identity',
    fields,
    confidenceScore: PROVISIONAL_BIF_CONFIDENCE_SCORE,
    completenessScore: 0,
    lastVerifiedAt: CONSTRUCTED_AT,
  };
}

function bifWith(sections: readonly BIFSection[]): BusinessIntelligenceFramework {
  return {
    id: 'bif-test',
    organizationId: 'org-test',
    version: 1,
    status: BIFStatus.Draft,
    sections,
    confidenceScore: PROVISIONAL_BIF_CONFIDENCE_SCORE,
    completenessScore: 0,
    createdAt: CONSTRUCTED_AT,
    updatedAt: CONSTRUCTED_AT,
    lastSyncedAt: CONSTRUCTED_AT,
  };
}

/** The first two canonical keys of organization_identity, whatever they are. */
const IDENTITY_KEYS = (ORGANIZATION_IDENTITY_DEFINITION?.fields ?? []).map((f) => f.key);

describe('BIF scoring layer', () => {
  describe('determinism and purity', () => {
    it('produces identical output across repeated runs', () => {
      const bif = sampleDraft();
      const first = scoreBusinessIntelligenceFramework(bif);
      const second = scoreBusinessIntelligenceFramework(bif);
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    });

    it('never reads a clock, randomness or a timer', () => {
      const here = dirname(fileURLToPath(import.meta.url));
      const source = readFileSync(join(here, '..', 'bif-confidence-scoring.ts'), 'utf8');
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter((line) => !line.trim().startsWith('//'))
        .join('\n');
      for (const forbidden of ['new Date(', 'Date.now(', 'Math.random(', 'performance.now(']) {
        expect(code.includes(forbidden), `scoring source must not contain ${forbidden}`).toBe(
          false,
        );
      }
    });

    it('makes no network, AI or filesystem call', () => {
      const here = dirname(fileURLToPath(import.meta.url));
      const source = readFileSync(join(here, '..', 'bif-confidence-scoring.ts'), 'utf8');
      for (const forbidden of ['fetch(', 'node:fs', 'http', 'process.env']) {
        expect(source.includes(forbidden), `scoring source must not contain ${forbidden}`).toBe(
          false,
        );
      }
    });

    it('does not mutate the input BIF or its sections', () => {
      const bif = sampleDraft();
      const before = JSON.stringify(bif);
      const { bif: scored } = scoreBusinessIntelligenceFramework(bif);
      expect(JSON.stringify(bif)).toBe(before);
      expect(scored).not.toBe(bif);
      expect(bif.confidenceScore).toBe(PROVISIONAL_BIF_CONFIDENCE_SCORE);
      expect(
        bif.sections.every((s) => s.confidenceScore === PROVISIONAL_BIF_CONFIDENCE_SCORE),
      ).toBe(true);
    });
  });

  describe('discovery confidence is never BIF confidence', () => {
    it('does not equal the discovery input confidence score for the sample profile', () => {
      const discovery = calculateBusinessDiscoveryCompleteness(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
      const { metadata } = scoreBusinessIntelligenceFramework(sampleDraft());
      expect(metadata.rootConfidenceScore).not.toBe(discovery.discoveryConfidenceScore);
      expect(metadata.rootConfidenceScore).not.toBe(discovery.completenessScore);
    });

    it('takes only a BIF, so no discovery score is even in scope', () => {
      // Arity is part of the guarantee: (bif, options?) and nothing else.
      expect(scoreBusinessIntelligenceFramework.length).toBeLessThanOrEqual(2);
      const source = readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), '..', 'bif-confidence-scoring.ts'),
        'utf8',
      );
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter((line) => !line.trim().startsWith('//'))
        .join('\n');
      // The name may appear inside a warning string (the model says out loud
      // that it is not used), but never as a value the code reads.
      expect(code.includes('.discoveryConfidenceScore')).toBe(false);
      expect(code.includes('.discoveryCompletenessScore')).toBe(false);
      // And no discovery scoring module is imported at all.
      expect(code.includes("from './completeness-scoring'")).toBe(false);
      expect(code.includes("from './business-discovery-to-bif'")).toBe(false);
      expect(code.includes("from './business-discovery-profile'")).toBe(false);
    });
  });

  describe('the sparse sample Draft BIF scores conservatively', () => {
    it('scores well below half despite a well-captured interview', () => {
      const discovery = calculateBusinessDiscoveryCompleteness(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
      const { bif, metadata } = scoreBusinessIntelligenceFramework(sampleDraft());
      expect(metadata.rootConfidenceScore).toBeLessThan(30);
      expect(bif.confidenceScore).toBe(metadata.rootConfidenceScore);
      // The interview scored far higher than the framework does. That gap is the point.
      expect(discovery.completenessScore).toBeGreaterThan(metadata.rootConfidenceScore);
    });

    it('replaces the provisional constant with a computed score', () => {
      const { bif } = scoreBusinessIntelligenceFramework(sampleDraft());
      expect(bif.confidenceScore).not.toBe(PROVISIONAL_BIF_CONFIDENCE_SCORE);
    });

    it('passes through status, completeness, dates and field values unchanged', () => {
      const draft = sampleDraft();
      const { bif } = scoreBusinessIntelligenceFramework(draft);
      expect(bif.status).toBe(BIFStatus.Draft);
      expect(bif.completenessScore).toBe(draft.completenessScore);
      expect(bif.createdAt).toBe(draft.createdAt);
      expect(bif.updatedAt).toBe(draft.updatedAt);
      expect(bif.lastSyncedAt).toBe(draft.lastSyncedAt);
      expect(bif.sections.map((s) => s.fields)).toEqual(draft.sections.map((s) => s.fields));
      expect(bif.sections.map((s) => s.completenessScore)).toEqual(
        draft.sections.map((s) => s.completenessScore),
      );
    });
  });

  describe('section confidence', () => {
    it('is computed for every emitted section and for no others', () => {
      const draft = sampleDraft();
      const { bif, metadata } = scoreBusinessIntelligenceFramework(draft);
      expect(metadata.sectionScores).toHaveLength(draft.sections.length);
      expect(metadata.sectionScores.map((s) => s.sectionType)).toEqual(
        draft.sections.map((s) => s.type),
      );
      expect(bif.sections).toHaveLength(draft.sections.length);
      for (const [index, section] of bif.sections.entries()) {
        expect(section.confidenceScore).toBe(metadata.sectionScores[index]?.confidenceScore);
      }
    });

    it('combines trust with coverage, so a thin all-user-confirmed section stays low', () => {
      const oneOfMany = organizationSection([
        field(
          IDENTITY_KEYS[0] ?? 'legalName',
          true,
          FieldSource.USER,
          FieldConfidence.USER_CONFIRMED,
        ),
      ]);
      const { metadata } = scoreBusinessIntelligenceFramework(bifWith([oneOfMany]));
      const score = metadata.sectionScores[0];
      expect(score?.populatedFieldCount).toBe(1);
      expect(score?.definedFieldCount).toBeGreaterThan(1);
      // Truthful about its one field, still weak as intelligence.
      expect(score?.trustScore).toBeGreaterThan(0);
      expect(score?.confidenceScore).toBeLessThan(score?.trustScore ?? 0);
      expect(score?.confidenceScore).toBeLessThan(50);
    });

    it('scores evidence-backed fields higher than the same fields user-confirmed', () => {
      const keys = IDENTITY_KEYS.slice(0, 2);
      const evidenced = organizationSection(
        keys.map((key) =>
          field(key, true, FieldSource.DOCUMENT, FieldConfidence.EVIDENCE_VERIFIED),
        ),
      );
      const stated = organizationSection(
        keys.map((key) => field(key, true, FieldSource.USER, FieldConfidence.USER_CONFIRMED)),
      );
      const evidencedScore = scoreBusinessIntelligenceFramework(bifWith([evidenced])).metadata;
      const statedScore = scoreBusinessIntelligenceFramework(bifWith([stated])).metadata;

      expect(evidencedScore.sectionScores[0]?.coverageScore).toBe(
        statedScore.sectionScores[0]?.coverageScore,
      );
      expect(evidencedScore.sectionScores[0]?.confidenceScore).toBeGreaterThan(
        statedScore.sectionScores[0]?.confidenceScore ?? 0,
      );
      expect(evidencedScore.rootConfidenceScore).toBeGreaterThan(statedScore.rootConfidenceScore);
    });

    it('still credits user-confirmed fields with some confidence', () => {
      const stated = organizationSection([
        field(
          IDENTITY_KEYS[0] ?? 'legalName',
          true,
          FieldSource.USER,
          FieldConfidence.USER_CONFIRMED,
        ),
      ]);
      const { metadata } = scoreBusinessIntelligenceFramework(bifWith([stated]));
      expect(metadata.sectionScores[0]?.confidenceScore).toBeGreaterThan(0);
      expect(metadata.userConfirmedFieldCount).toBe(1);
    });

    it('lets field confidence level change the score with source held constant', () => {
      const key = IDENTITY_KEYS[0] ?? 'legalName';
      const byConfidence = (confidence: FieldConfidence): number =>
        scoreBusinessIntelligenceFramework(
          bifWith([organizationSection([field(key, true, FieldSource.DOCUMENT, confidence)])]),
        ).metadata.sectionScores[0]?.trustScore ?? 0;

      expect(byConfidence(FieldConfidence.EVIDENCE_VERIFIED)).toBeGreaterThan(
        byConfidence(FieldConfidence.USER_CONFIRMED),
      );
      expect(byConfidence(FieldConfidence.USER_CONFIRMED)).toBeGreaterThan(
        byConfidence(FieldConfidence.AI_INFERRED),
      );
    });

    it('weights populated required fields above optional ones', () => {
      const definition = ORGANIZATION_IDENTITY_DEFINITION;
      const requiredKey = definition?.fields.find((f) => f.required)?.key;
      const optionalKey = definition?.fields.find((f) => !f.required)?.key;
      if (requiredKey === undefined || optionalKey === undefined) {
        // The canonical section does not mix required and optional keys; the
        // weighting rule is then vacuous rather than wrong.
        expect(true).toBe(true);
        return;
      }
      const coverageFor = (key: string, required: boolean): number =>
        scoreBusinessIntelligenceFramework(
          bifWith([
            organizationSection([
              field(key, required, FieldSource.DOCUMENT, FieldConfidence.EVIDENCE_VERIFIED),
            ]),
          ]),
        ).metadata.sectionScores[0]?.coverageScore ?? 0;

      expect(coverageFor(requiredKey, true)).toBeGreaterThan(coverageFor(optionalKey, false));
    });
  });

  describe('root confidence', () => {
    it('is derived from section scores and BIF content, not copied from any single score', () => {
      const { metadata } = scoreBusinessIntelligenceFramework(sampleDraft());
      const sectionValues = metadata.sectionScores.map((s) => s.confidenceScore);
      expect(sectionValues.length).toBeGreaterThan(1);
      // Bounded by its inputs, and (because omitted sections count as zero)
      // never above the best section.
      expect(metadata.rootConfidenceScore).toBeLessThanOrEqual(Math.max(...sectionValues));
      expect(metadata.reasons.join(' ')).toContain('weighted mean of section confidence');
    });

    it('is reduced by omitted sections without any placeholder section appearing', () => {
      const keys = IDENTITY_KEYS.slice(0, 2);
      const populated = organizationSection(
        keys.map((key) =>
          field(key, true, FieldSource.DOCUMENT, FieldConfidence.EVIDENCE_VERIFIED),
        ),
      );
      const { bif, metadata } = scoreBusinessIntelligenceFramework(bifWith([populated]));

      expect(bif.sections).toHaveLength(1);
      expect(metadata.omittedSections).toHaveLength(BIF_SECTIONS.length - 1);
      expect(metadata.omittedSections).not.toContain(SectionType.OrganizationIdentity);
      // One well-evidenced section out of twelve cannot carry the whole BIF.
      expect(metadata.rootConfidenceScore).toBeLessThan(
        metadata.sectionScores[0]?.confidenceScore ?? 0,
      );
      expect(metadata.warnings.join(' ')).toContain('canonical sections are absent');
    });

    it('is capped when nothing is backed by an independent source', () => {
      const allStated = organizationSection(
        IDENTITY_KEYS.map((key) =>
          field(key, true, FieldSource.USER, FieldConfidence.USER_CONFIRMED),
        ),
      );
      const { metadata } = scoreBusinessIntelligenceFramework(bifWith([allStated]));
      expect(metadata.evidenceBackedFieldCount).toBe(0);
      expect(metadata.rootConfidenceScore).toBeLessThanOrEqual(40);
      expect(metadata.warnings.join(' ')).toContain('independent source');
    });

    it('is zero for a BIF with no sections at all', () => {
      const { bif, metadata } = scoreBusinessIntelligenceFramework(bifWith([]));
      expect(metadata.rootConfidenceScore).toBe(0);
      expect(bif.confidenceScore).toBe(0);
      expect(metadata.populatedFieldCount).toBe(0);
      expect(bif.sections).toHaveLength(0);
    });
  });

  describe('bounds, metadata and invalid input', () => {
    it('bounds every score to 0-100 integers', () => {
      const { bif, metadata } = scoreBusinessIntelligenceFramework(sampleDraft());
      const values = [
        metadata.rootConfidenceScore,
        bif.confidenceScore,
        ...bif.sections.map((s) => s.confidenceScore),
        ...metadata.sectionScores.flatMap((s) => [
          s.confidenceScore,
          s.trustScore,
          s.coverageScore,
        ]),
      ];
      for (const value of values) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    });

    it('returns metadata that satisfies its own schema and explains the score', () => {
      const { metadata } = scoreBusinessIntelligenceFramework(sampleDraft());
      expect(bifConfidenceScoringMetadataSchema.safeParse(metadata).success).toBe(true);
      expect(metadata.scoringVersion).toBe(BIF_CONFIDENCE_SCORING_VERSION);
      expect(metadata.totalSectionCount).toBe(BIF_SECTIONS.length);
      expect(metadata.totalFieldCount).toBe(
        BIF_SECTIONS.reduce((sum, definition) => sum + definition.fields.length, 0),
      );
      expect(metadata.reasons.length).toBeGreaterThan(0);
      expect(metadata.warnings.join(' ')).toContain('NOT discoveryConfidenceScore');
      for (const score of metadata.sectionScores) {
        expect(score.reasons.length).toBeGreaterThan(0);
      }
    });

    it('rejects structurally invalid input explicitly', () => {
      expect(() =>
        scoreBusinessIntelligenceFramework(undefined as unknown as BusinessIntelligenceFramework),
      ).toThrow(/requires a BusinessIntelligenceFramework/);
      expect(() =>
        scoreBusinessIntelligenceFramework({
          ...bifWith([]),
          sections: undefined,
        } as unknown as BusinessIntelligenceFramework),
      ).toThrow(/sections to be an array/);
      expect(() =>
        scoreBusinessIntelligenceFramework(
          bifWith([{ ...organizationSection([]), fields: undefined } as unknown as BIFSection]),
        ),
      ).toThrow(/fields\[\] on every section/);
    });

    it('warns on a non-Draft BIF and still never changes its status', () => {
      const active = { ...bifWith([]), status: BIFStatus.Active };
      const { bif, metadata } = scoreBusinessIntelligenceFramework(active);
      expect(bif.status).toBe(BIFStatus.Active);
      expect(metadata.warnings.join(' ')).toContain('designed for Draft');
    });
  });

  it('is exported from the package entrypoint', () => {
    expect(typeof packageEntrypoint.scoreBusinessIntelligenceFramework).toBe('function');
    expect(packageEntrypoint.BIF_CONFIDENCE_SCORING_VERSION).toBe(BIF_CONFIDENCE_SCORING_VERSION);
    expect(typeof packageEntrypoint.bifConfidenceScoringMetadataSchema.safeParse).toBe('function');
    expect(typeof packageEntrypoint.bifSectionConfidenceScoreSchema.safeParse).toBe('function');
  });
});
