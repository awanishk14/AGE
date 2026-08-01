import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BIF_SECTIONS, BIFStatus, FieldConfidence, FieldSource, SectionType } from '@age/bif';
import * as packageEntrypoint from '../index';
import {
  BUSINESS_DISCOVERY_TO_BIF_MAPPING_VERSION,
  PROVISIONAL_BIF_CONFIDENCE_SCORE,
  mapBusinessDiscoveryToBifDraft,
} from '../business-discovery-to-bif';
import { SAMPLE_BUSINESS_DISCOVERY_PROFILE } from '../sample-profile';
import { calculateBusinessDiscoveryCompleteness } from '../completeness-scoring';
import type { BusinessDiscoveryProfile } from '../business-discovery-profile';
import type { BusinessDiscoveryToBifOptions } from '../business-discovery-to-bif';

const CONSTRUCTED_AT = new Date('2026-07-15T09:30:00.000Z');

const OPTIONS: BusinessDiscoveryToBifOptions = {
  organizationId: 'org-northwind',
  constructedAt: CONSTRUCTED_AT,
  changedBy: 'analyst@example.com',
};

/** Sample content with no captured answers, so only field-level evidence applies. */
const STRUCTURED_ONLY: BusinessDiscoveryProfile = {
  ...SAMPLE_BUSINESS_DISCOVERY_PROFILE,
  sections: [],
};

describe('Discovery -> BIF draft mapper', () => {
  describe('BIF shape and draft nature', () => {
    it('returns a BIF plus mapper metadata', () => {
      const { bif, metadata } = mapBusinessDiscoveryToBifDraft(
        SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        OPTIONS,
      );
      expect(bif.id).toBe(`bif-${SAMPLE_BUSINESS_DISCOVERY_PROFILE.id}`);
      expect(bif.organizationId).toBe('org-northwind');
      expect(bif.version).toBe(1);
      expect(metadata.sourceProfileId).toBe(SAMPLE_BUSINESS_DISCOVERY_PROFILE.id);
      expect(metadata.mappingVersion).toBe(BUSINESS_DISCOVERY_TO_BIF_MAPPING_VERSION);
    });

    it('emits Draft status', () => {
      const { bif } = mapBusinessDiscoveryToBifDraft(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS);
      expect(bif.status).toBe(BIFStatus.Draft);
    });

    it('omits sections discovery cannot populate, never placeholder-filling them', () => {
      const { bif, metadata } = mapBusinessDiscoveryToBifDraft(
        SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        OPTIONS,
      );
      const emitted = bif.sections.map((section) => section.type);
      expect(emitted).toEqual(metadata.mappedSections);

      // Nothing discovery has no source for may appear.
      for (const absent of [
        SectionType.MarketingIntelligence,
        SectionType.TechnologyStack,
        SectionType.Kpis,
        SectionType.Assets,
        SectionType.Constraints,
      ]) {
        expect(emitted).not.toContain(absent);
        expect(metadata.omittedSections).toContain(absent);
      }

      // Every emitted section carries at least one real field.
      for (const section of bif.sections) {
        expect(section.fields.length).toBeGreaterThan(0);
        for (const field of section.fields) {
          expect(field.value).toBeDefined();
        }
      }
    });

    it('accounts for every canonical section as either mapped or omitted', () => {
      const { metadata } = mapBusinessDiscoveryToBifDraft(
        SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        OPTIONS,
      );
      const all = Object.values(SectionType);
      expect([...metadata.mappedSections, ...metadata.omittedSections].sort()).toEqual(
        [...all].sort(),
      );
    });

    it('emits only canonical BIF field keys', () => {
      const { bif } = mapBusinessDiscoveryToBifDraft(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS);
      const organization = bif.sections.find(
        (section) => section.type === SectionType.OrganizationIdentity,
      );
      expect(organization?.fields.map((f) => f.key).sort()).toEqual(
        ['businessModel', 'industry', 'legalName', 'operatingCountries'].sort(),
      );
    });

    it('maps only long-horizon goals and reports the rest as unmapped', () => {
      const { bif, metadata } = mapBusinessDiscoveryToBifDraft(
        SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        OPTIONS,
      );
      const vision = bif.sections.find((section) => section.type === SectionType.VisionStrategy);
      expect(vision?.fields.map((f) => f.key)).toEqual(['longTermGoals']);
      expect(vision?.fields[0]?.value).toEqual(['Establish a foothold in the UK market']);
      expect(metadata.unmappedDiscoveryFields.map((u) => u.field)).toContain(
        'goals[horizon=short|medium]',
      );
    });
  });

  describe('caller-supplied context (ADR-0025 Decision 1)', () => {
    it('uses constructedAt for every Date it emits', () => {
      const { bif } = mapBusinessDiscoveryToBifDraft(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS);
      expect(bif.createdAt).toBe(CONSTRUCTED_AT);
      expect(bif.updatedAt).toBe(CONSTRUCTED_AT);
      expect(bif.lastSyncedAt).toBe(CONSTRUCTED_AT);
      for (const section of bif.sections) {
        expect(section.lastVerifiedAt).toBe(CONSTRUCTED_AT);
        for (const field of section.fields) {
          expect(field.lastVerifiedAt).toBe(CONSTRUCTED_AT);
          for (const version of field.history) {
            expect(version.timestamp).toBe(CONSTRUCTED_AT);
          }
        }
      }
    });

    it('never reads the wall clock at runtime', () => {
      const realNow = Date.now;
      let clockReads = 0;
      Date.now = () => {
        clockReads += 1;
        return 0;
      };
      try {
        mapBusinessDiscoveryToBifDraft(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS);
      } finally {
        Date.now = realNow;
      }
      expect(clockReads).toBe(0);
    });

    it('contains no clock call in its source (static guard)', () => {
      // Stubbing `Date.now` alone would not catch a bare `new Date()`, so the
      // module source is checked directly — the same approach the demo-runtime
      // purity guard uses.
      const here = dirname(fileURLToPath(import.meta.url));
      const source = readFileSync(join(here, '..', 'business-discovery-to-bif.ts'), 'utf8');
      // Strip comments, which legitimately mention `new Date()` when explaining
      // that it is never called.
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter((line) => !line.trim().startsWith('//'))
        .join('\n');
      for (const forbidden of ['new Date(', 'Date.now(', 'Math.random(', 'performance.now(']) {
        expect(code.includes(forbidden), `mapper source must not contain ${forbidden}`).toBe(false);
      }
    });

    it('records changedBy from options on every field version', () => {
      const { bif } = mapBusinessDiscoveryToBifDraft(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS);
      const actors = bif.sections.flatMap((section) =>
        section.fields.flatMap((field) => field.history.map((version) => version.changedBy)),
      );
      expect(actors.length).toBeGreaterThan(0);
      expect(new Set(actors)).toEqual(new Set(['analyst@example.com']));
    });

    it('rejects missing caller context rather than inventing it', () => {
      expect(() =>
        mapBusinessDiscoveryToBifDraft(SAMPLE_BUSINESS_DISCOVERY_PROFILE, {
          ...OPTIONS,
          changedBy: '   ',
        }),
      ).toThrow(/changedBy/);
      expect(() =>
        mapBusinessDiscoveryToBifDraft(SAMPLE_BUSINESS_DISCOVERY_PROFILE, {
          ...OPTIONS,
          organizationId: '',
        }),
      ).toThrow(/organizationId/);
      expect(() =>
        mapBusinessDiscoveryToBifDraft(SAMPLE_BUSINESS_DISCOVERY_PROFILE, {
          ...OPTIONS,
          constructedAt: new Date('not-a-date'),
        }),
      ).toThrow(/constructedAt/);
    });

    it('derives ids from input, never randomly', () => {
      const a = mapBusinessDiscoveryToBifDraft(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS);
      const b = mapBusinessDiscoveryToBifDraft(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS);
      expect(a.bif.id).toBe(b.bif.id);
      expect(a.bif.sections.map((s) => s.id)).toEqual(b.bif.sections.map((s) => s.id));
      const custom = mapBusinessDiscoveryToBifDraft(SAMPLE_BUSINESS_DISCOVERY_PROFILE, {
        ...OPTIONS,
        bifId: 'bif-custom',
      });
      expect(custom.bif.id).toBe('bif-custom');
      expect(custom.bif.sections[0]?.id.startsWith('bif-custom-')).toBe(true);
    });
  });

  describe('provenance (ADR-0025 Decision 2)', () => {
    it('marks uncited client-stated fields as USER / USER_CONFIRMED', () => {
      const { bif } = mapBusinessDiscoveryToBifDraft(STRUCTURED_ONLY, OPTIONS);
      const organization = bif.sections.find(
        (section) => section.type === SectionType.OrganizationIdentity,
      );
      const industry = organization?.fields.find((field) => field.key === 'industry');
      expect(industry?.source).toBe(FieldSource.USER);
      expect(industry?.confidence).toBe(FieldConfidence.USER_CONFIRMED);
    });

    it('marks fields with valid field-level evidence as EVIDENCE_VERIFIED', () => {
      const documentSource = SAMPLE_BUSINESS_DISCOVERY_PROFILE.evidenceSources.find(
        (source) => source.kind === 'document',
      );
      expect(documentSource).toBeDefined();
      const { bif, metadata } = mapBusinessDiscoveryToBifDraft(
        { ...STRUCTURED_ONLY, fieldEvidence: { industry: [documentSource?.id ?? ''] } },
        OPTIONS,
      );
      const industry = bif.sections
        .find((section) => section.type === SectionType.OrganizationIdentity)
        ?.fields.find((field) => field.key === 'industry');
      expect(industry?.confidence).toBe(FieldConfidence.EVIDENCE_VERIFIED);
      expect(industry?.source).toBe(FieldSource.DOCUMENT);
      expect(metadata.provenanceSummary.evidencedDiscoveryFieldPaths).toContain('industry');
    });

    it('ignores dangling field evidence and falls back to USER_CONFIRMED', () => {
      const { bif, metadata } = mapBusinessDiscoveryToBifDraft(
        { ...STRUCTURED_ONLY, fieldEvidence: { industry: ['ev-does-not-exist'] } },
        OPTIONS,
      );
      const industry = bif.sections
        .find((section) => section.type === SectionType.OrganizationIdentity)
        ?.fields.find((field) => field.key === 'industry');
      expect(industry?.confidence).toBe(FieldConfidence.USER_CONFIRMED);
      expect(metadata.provenanceSummary.evidencedDiscoveryFieldPaths).not.toContain('industry');
    });

    it('lets answer-level evidence produce EVIDENCE_VERIFIED provenance', () => {
      // The sample cites evidence on its bi-name answer, which satisfies the
      // `businessName` signal.
      const { bif } = mapBusinessDiscoveryToBifDraft(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS);
      const legalName = bif.sections
        .find((section) => section.type === SectionType.OrganizationIdentity)
        ?.fields.find((field) => field.key === 'legalName');
      expect(legalName?.confidence).toBe(FieldConfidence.EVIDENCE_VERIFIED);
    });

    it('never emits AI_INFERRED', () => {
      const profiles = [SAMPLE_BUSINESS_DISCOVERY_PROFILE, STRUCTURED_ONLY];
      for (const profile of profiles) {
        const { bif, metadata } = mapBusinessDiscoveryToBifDraft(profile, OPTIONS);
        for (const section of bif.sections) {
          for (const field of section.fields) {
            expect(field.source).not.toBe(FieldSource.AI_INFERRED);
            expect(field.confidence).not.toBe(FieldConfidence.AI_INFERRED);
            for (const version of field.history) {
              expect(version.confidence).not.toBe(FieldConfidence.AI_INFERRED);
            }
          }
        }
        expect(metadata.provenanceSummary.aiInferredFieldCount).toBe(0);
      }
    });

    it('counts every emitted field as either evidence-verified or user-confirmed', () => {
      const { bif, metadata } = mapBusinessDiscoveryToBifDraft(
        SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        OPTIONS,
      );
      const totalFields = bif.sections.reduce((sum, section) => sum + section.fields.length, 0);
      const { evidenceVerifiedFieldCount, userConfirmedFieldCount } = metadata.provenanceSummary;
      expect(evidenceVerifiedFieldCount + userConfirmedFieldCount).toBe(totalFields);
    });
  });

  describe('score mapping (ADR-0025 Decision 3)', () => {
    it('does NOT put discovery capture completeness on the BIF root', () => {
      const scoring = calculateBusinessDiscoveryCompleteness(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
      const { bif } = mapBusinessDiscoveryToBifDraft(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS);
      // The sample is a near-complete intake (98) that populates a small part of
      // the BIF surface. If those two ever coincided the assertion below would be
      // vacuous, so guard that they genuinely differ on this fixture.
      expect(scoring.completenessScore).toBe(98);
      expect(bif.completenessScore).not.toBe(scoring.completenessScore);
      expect(bif.completenessScore).toBeLessThan(scoring.completenessScore);
    });

    it('preserves discoveryCompletenessScore in metadata, unchanged', () => {
      const scoring = calculateBusinessDiscoveryCompleteness(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
      const { metadata } = mapBusinessDiscoveryToBifDraft(
        SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        OPTIONS,
      );
      expect(metadata.discoveryCompletenessScore).toBe(scoring.completenessScore);
      expect(metadata.discoveryCompletenessScore).toBe(98);
    });

    it('computes the BIF root completeness from emitted fields over BIF definitions', () => {
      const { bif, metadata } = mapBusinessDiscoveryToBifDraft(
        SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        OPTIONS,
      );

      // Denominators are BIF's own, over all twelve canonical sections.
      const definedFieldCount = BIF_SECTIONS.reduce((sum, s) => sum + s.fields.length, 0);
      const emittedFieldCount = bif.sections.reduce((sum, s) => sum + s.fields.length, 0);

      expect(metadata.totalBifSectionCount).toBe(BIF_SECTIONS.length);
      expect(metadata.totalBifFieldCount).toBe(definedFieldCount);
      expect(metadata.populatedFieldCount).toBe(emittedFieldCount);
      expect(metadata.mappedSectionCount).toBe(bif.sections.length);

      const expected = Math.round((emittedFieldCount / definedFieldCount) * 100);
      expect(metadata.bifPopulationCompletenessScore).toBe(expected);
      expect(bif.completenessScore).toBe(expected);
    });

    it('reports required-field population from BIF definitions', () => {
      const { bif, metadata } = mapBusinessDiscoveryToBifDraft(
        SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        OPTIONS,
      );
      const requiredDefined = BIF_SECTIONS.reduce(
        (sum, s) => sum + s.fields.filter((f) => f.required).length,
        0,
      );
      const requiredEmitted = bif.sections.reduce(
        (sum, s) => sum + s.fields.filter((f) => f.required).length,
        0,
      );
      expect(metadata.totalRequiredBifFieldCount).toBe(requiredDefined);
      expect(metadata.populatedRequiredFieldCount).toBe(requiredEmitted);
      expect(metadata.populatedRequiredFieldCount).toBeLessThanOrEqual(
        metadata.totalRequiredBifFieldCount,
      );
    });

    it('counts omitted sections against BIF population completeness', () => {
      const { bif, metadata } = mapBusinessDiscoveryToBifDraft(
        SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        OPTIONS,
      );
      // Every canonical section appears in the population breakdown, including
      // the omitted ones at zero — excluding them would inflate the root score.
      expect(metadata.sectionPopulation).toHaveLength(BIF_SECTIONS.length);
      for (const omitted of metadata.omittedSections) {
        const entry = metadata.sectionPopulation.find((p) => p.sectionType === omitted);
        expect(entry?.populatedFieldCount).toBe(0);
        expect(entry?.populationCompletenessScore).toBe(0);
      }
      const mappedOnly = metadata.sectionPopulation
        .filter((p) => metadata.mappedSections.includes(p.sectionType))
        .reduce((sum, p) => sum + p.definedFieldCount, 0);
      expect(metadata.totalBifFieldCount).toBeGreaterThan(mappedOnly);
      expect(bif.completenessScore).toBeLessThan(
        Math.round((metadata.populatedFieldCount / mappedOnly) * 100),
      );
    });

    it('produces deterministic mapped section and field counts', () => {
      const first = mapBusinessDiscoveryToBifDraft(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS);
      const second = mapBusinessDiscoveryToBifDraft(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS);

      expect(second.metadata.mappedSectionCount).toBe(first.metadata.mappedSectionCount);
      expect(second.metadata.populatedFieldCount).toBe(first.metadata.populatedFieldCount);
      expect(second.metadata.bifPopulationCompletenessScore).toBe(
        first.metadata.bifPopulationCompletenessScore,
      );
      expect(second.metadata.sectionPopulation).toEqual(first.metadata.sectionPopulation);
      expect(second.bif.completenessScore).toBe(first.bif.completenessScore);

      // Pinned sample values: these change only when the mapping rules or the
      // fixture change, never run to run.
      expect(first.metadata.mappedSectionCount).toBe(7);
      expect(first.metadata.populatedFieldCount).toBe(10);
    });

    it('adds no placeholder fields or sections to inflate completeness', () => {
      const { bif } = mapBusinessDiscoveryToBifDraft(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS);
      for (const section of bif.sections) {
        expect(section.fields.length).toBeGreaterThan(0);
        for (const field of section.fields) {
          expect(field.value).not.toBeUndefined();
          expect(field.value).not.toBeNull();
          if (typeof field.value === 'string') {
            expect(field.value.trim().length).toBeGreaterThan(0);
          }
          if (Array.isArray(field.value)) {
            expect(field.value.length).toBeGreaterThan(0);
          }
        }
      }
    });

    it('never writes discoveryConfidenceScore into any BIF confidence field', () => {
      const scoring = calculateBusinessDiscoveryCompleteness(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
      const { bif, metadata } = mapBusinessDiscoveryToBifDraft(
        SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        OPTIONS,
      );
      // The discovery confidence is non-trivial, so an accidental copy would show.
      expect(scoring.discoveryConfidenceScore).toBeGreaterThan(0);
      expect(metadata.discoveryConfidenceScore).toBe(scoring.discoveryConfidenceScore);

      expect(bif.confidenceScore).toBe(PROVISIONAL_BIF_CONFIDENCE_SCORE);
      expect(bif.confidenceScore).not.toBe(scoring.discoveryConfidenceScore);
      for (const section of bif.sections) {
        expect(section.confidenceScore).toBe(PROVISIONAL_BIF_CONFIDENCE_SCORE);
        expect(section.confidenceScore).not.toBe(scoring.discoveryConfidenceScore);
      }
    });

    it('warns that BIF confidence is provisional', () => {
      const { metadata } = mapBusinessDiscoveryToBifDraft(
        SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        OPTIONS,
      );
      expect(metadata.warnings.some((warning) => warning.includes('provisional'))).toBe(true);
      expect(metadata.warnings.length).toBeGreaterThanOrEqual(3);
    });

    it('sets section completeness to that section population, not discovery capture', () => {
      const scoring = calculateBusinessDiscoveryCompleteness(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
      const { bif, metadata } = mapBusinessDiscoveryToBifDraft(
        SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        OPTIONS,
      );
      const identity = bif.sections.find(
        (section) => section.type === SectionType.OrganizationIdentity,
      );
      const definition = BIF_SECTIONS.find(
        (section) => section.type === SectionType.OrganizationIdentity,
      );
      const expected = Math.round(
        ((identity?.fields.length ?? 0) / (definition?.fields.length ?? 1)) * 100,
      );
      expect(identity?.completenessScore).toBe(expected);

      // The discovery capture score for the feeding intake section is preserved
      // in metadata, and is a different number here.
      const discoveryIdentity = scoring.breakdown.sections.find(
        (section) => section.sectionId === 'business-identity',
      );
      const population = metadata.sectionPopulation.find(
        (entry) => entry.sectionType === SectionType.OrganizationIdentity,
      );
      expect(population?.discoveryCaptureCompletenessScore).toBe(discoveryIdentity?.score);
      expect(identity?.completenessScore).not.toBe(discoveryIdentity?.score);
    });

    it('every section completeness equals its own population ratio', () => {
      const { bif } = mapBusinessDiscoveryToBifDraft(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS);
      for (const section of bif.sections) {
        const definition = BIF_SECTIONS.find((d) => d.type === section.type);
        expect(definition).toBeDefined();
        expect(section.completenessScore).toBe(
          Math.round((section.fields.length / (definition?.fields.length ?? 1)) * 100),
        );
        expect(section.completenessScore).toBeLessThanOrEqual(100);
      }
    });

    it('warns that discovery completeness and BIF population completeness are separate', () => {
      const { bif, metadata } = mapBusinessDiscoveryToBifDraft(
        SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        OPTIONS,
      );
      const warning = metadata.warnings.find((entry) => entry.includes('SEPARATE metrics'));
      expect(warning).toBeDefined();
      // The warning must name both metrics and quote both live values, so a
      // reader cannot mistake one for the other.
      expect(warning).toContain('discoveryCompletenessScore');
      expect(warning).toContain('bif.completenessScore');
      expect(warning).toContain(String(metadata.discoveryCompletenessScore));
      expect(warning).toContain(String(bif.completenessScore));
      expect(warning).toContain('intake capture completeness');

      // And no warning may still claim the root carries discovery capture.
      expect(
        metadata.warnings.some((entry) =>
          entry.includes('completenessScore reflects discovery capture completeness'),
        ),
      ).toBe(false);
    });
  });

  describe('unmapped discovery data', () => {
    it('reports free-text assets and constraints as unmapped, with reasons', () => {
      const { metadata } = mapBusinessDiscoveryToBifDraft(
        SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        OPTIONS,
      );
      const fields = metadata.unmappedDiscoveryFields.map((entry) => entry.field);
      expect(fields).toContain('assets');
      expect(fields).toContain('constraints');
      expect(fields).toContain('assumptions');
      expect(fields).toContain('gaps');
      for (const entry of metadata.unmappedDiscoveryFields) {
        expect(entry.reason.length).toBeGreaterThan(20);
      }
    });
  });

  describe('purity', () => {
    it('is deterministic for the same input and options', () => {
      const a = mapBusinessDiscoveryToBifDraft(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS);
      const b = mapBusinessDiscoveryToBifDraft(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS);
      expect(a).toEqual(b);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it('does not mutate the input profile', () => {
      const before = JSON.stringify(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
      mapBusinessDiscoveryToBifDraft(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS);
      expect(JSON.stringify(SAMPLE_BUSINESS_DISCOVERY_PROFILE)).toBe(before);
    });

    it('rejects an invalid profile at the schema boundary', () => {
      const invalid = { ...SAMPLE_BUSINESS_DISCOVERY_PROFILE, businessName: '' };
      expect(() =>
        mapBusinessDiscoveryToBifDraft(invalid as BusinessDiscoveryProfile, OPTIONS),
      ).toThrow(/profile/i);
    });
  });

  describe('package entrypoint', () => {
    it('exports the mapper API', () => {
      expect(typeof packageEntrypoint.mapBusinessDiscoveryToBifDraft).toBe('function');
      expect(packageEntrypoint.BUSINESS_DISCOVERY_TO_BIF_MAPPING_VERSION).toBe(
        BUSINESS_DISCOVERY_TO_BIF_MAPPING_VERSION,
      );
      expect(packageEntrypoint.PROVISIONAL_BIF_CONFIDENCE_SCORE).toBe(
        PROVISIONAL_BIF_CONFIDENCE_SCORE,
      );
    });
  });
});
