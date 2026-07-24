import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BIF_SECTIONS, BIFStatus, SectionType, type BusinessIntelligenceFramework } from '@age/bif';
import * as packageEntrypoint from '../index';
import {
  SCORED_BIF_CONTEXT_VERSION,
  projectScoredBifContext,
  scoredBifContextSchema,
} from '../scored-bif-context';
import { scoreBusinessIntelligenceFramework } from '../bif-confidence-scoring';
import { mapBusinessDiscoveryToBifDraft } from '../business-discovery-to-bif';
import { SAMPLE_BUSINESS_DISCOVERY_PROFILE } from '../sample-profile';

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

/** The scored sample Draft BIF plus its scoring metadata (PR #79). */
function scoredSample() {
  return scoreBusinessIntelligenceFramework(sampleDraft());
}

describe('ScoredBifContext projection', () => {
  describe('construction from the sample scored Draft BIF', () => {
    it('projects the sample scored Draft BIF into a valid context', () => {
      const { bif, metadata } = scoredSample();
      const context = projectScoredBifContext(bif, { scoringMetadata: metadata });

      expect(() => scoredBifContextSchema.parse(context)).not.toThrow();
      expect(context.contextVersion).toBe(SCORED_BIF_CONTEXT_VERSION);
      expect(context.bifId).toBe(bif.id);
      expect(context.sections.length).toBeGreaterThan(0);
    });

    it('carries the root confidence and completeness scores unchanged', () => {
      const { bif, metadata } = scoredSample();
      const context = projectScoredBifContext(bif, { scoringMetadata: metadata });

      expect(context.bifConfidenceScore).toBe(bif.confidenceScore);
      expect(context.bifCompletenessScore).toBe(bif.completenessScore);
    });

    it('carries per-section confidence and completeness scores unchanged', () => {
      const { bif, metadata } = scoredSample();
      const context = projectScoredBifContext(bif, { scoringMetadata: metadata });

      expect(context.sections.length).toBe(bif.sections.length);
      for (const projected of context.sections) {
        const source = bif.sections.find((s) => s.id === projected.id);
        expect(source).toBeDefined();
        expect(projected.confidenceScore).toBe(source?.confidenceScore);
        expect(projected.completenessScore).toBe(source?.completenessScore);
        expect(projected.type).toBe(source?.type);
        expect(projected.name).toBe(source?.name);
      }
    });

    it('preserves field-level source and confidence provenance', () => {
      const { bif, metadata } = scoredSample();
      const context = projectScoredBifContext(bif, { scoringMetadata: metadata });

      const anySection = context.sections.find((s) => s.fields.length > 0);
      expect(anySection).toBeDefined();
      const projectedField = anySection?.fields[0];
      const sourceSection = bif.sections.find((s) => s.id === anySection?.id);
      const sourceField = sourceSection?.fields.find((f) => f.key === projectedField?.key);

      expect(projectedField?.source).toBe(sourceField?.source);
      expect(projectedField?.confidence).toBe(sourceField?.confidence);
      expect(projectedField?.value).toBe(sourceField?.value);
      expect(projectedField?.type).toBe(sourceField?.type);
      expect(projectedField?.required).toBe(sourceField?.required);
    });

    it('does not expose BIF field internals (history, timestamps)', () => {
      const { bif, metadata } = scoredSample();
      const context = projectScoredBifContext(bif, { scoringMetadata: metadata });

      for (const section of context.sections) {
        expect(section).not.toHaveProperty('lastVerifiedAt');
        for (const field of section.fields) {
          expect(field).not.toHaveProperty('history');
          expect(field).not.toHaveProperty('lastVerifiedAt');
        }
      }
    });
  });

  describe('determinism and purity', () => {
    it('produces an identical projection across repeated runs', () => {
      const { bif, metadata } = scoredSample();
      const first = projectScoredBifContext(bif, { scoringMetadata: metadata });
      const second = projectScoredBifContext(bif, { scoringMetadata: metadata });
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    });

    it('returns a fresh object on each call (no shared mutable state)', () => {
      const { bif, metadata } = scoredSample();
      const first = projectScoredBifContext(bif, { scoringMetadata: metadata });
      const second = projectScoredBifContext(bif, { scoringMetadata: metadata });
      expect(second).not.toBe(first);
      expect(second.sections).not.toBe(first.sections);
    });

    it('does not mutate the input BIF or its sections', () => {
      const { bif } = scoredSample();
      const before = JSON.stringify(bif);
      projectScoredBifContext(bif);
      expect(JSON.stringify(bif)).toBe(before);
    });

    it('never reads a clock, randomness or a timer', () => {
      const here = dirname(fileURLToPath(import.meta.url));
      const source = readFileSync(join(here, '..', 'scored-bif-context.ts'), 'utf8');
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
        .join('\n');
      for (const forbidden of ['new Date(', 'Date.now(', 'Math.random(', 'performance.now(']) {
        expect(code.includes(forbidden), `projection source must not contain ${forbidden}`).toBe(
          false,
        );
      }
    });

    it('makes no network, AI or filesystem call', () => {
      const here = dirname(fileURLToPath(import.meta.url));
      const source = readFileSync(join(here, '..', 'scored-bif-context.ts'), 'utf8');
      for (const forbidden of ['fetch(', 'node:fs', 'process.env']) {
        expect(source.includes(forbidden), `projection source must not contain ${forbidden}`).toBe(
          false,
        );
      }
    });

    it('never reads discovery-intake scores', () => {
      const here = dirname(fileURLToPath(import.meta.url));
      const source = readFileSync(join(here, '..', 'scored-bif-context.ts'), 'utf8');
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
        .join('\n');
      expect(code.includes('discoveryConfidenceScore')).toBe(false);
      expect(code.includes('discoveryCompletenessScore')).toBe(false);
    });
  });

  describe('status handling', () => {
    it('projects Draft status through unchanged and adds no warning', () => {
      const { bif, metadata } = scoredSample();
      expect(bif.status).toBe(BIFStatus.Draft);
      const context = projectScoredBifContext(bif, { scoringMetadata: metadata });

      expect(context.bifStatus).toBe(BIFStatus.Draft);
      expect(context.warnings.some((w) => w.includes('never promotes'))).toBe(false);
    });

    it('warns on a non-Draft BIF but still projects, never promoting', () => {
      const { bif } = scoredSample();
      const active: BusinessIntelligenceFramework = { ...bif, status: BIFStatus.Active };
      const context = projectScoredBifContext(active);

      expect(context.bifStatus).toBe(BIFStatus.Active);
      expect(context.warnings.some((w) => w.includes('never promotes'))).toBe(true);
      // The input is unchanged — projection promotes nothing.
      expect(active.status).toBe(BIFStatus.Active);
    });
  });

  describe('omitted sections are limitations, not negative evidence', () => {
    it('reports omitted canonical sections separately from present ones', () => {
      const { bif, metadata } = scoredSample();
      const context = projectScoredBifContext(bif, { scoringMetadata: metadata });

      const presentTypes = new Set(context.sections.map((s) => s.type));
      const omittedTypes = new Set(context.omittedSections.map((s) => s.type));

      // Present and omitted never overlap.
      for (const type of omittedTypes) {
        expect(presentTypes.has(type)).toBe(false);
      }
      // Together they account for the full canonical framework.
      expect(context.sections.length + context.omittedSections.length).toBe(BIF_SECTIONS.length);
    });

    it('creates no placeholder section for a missing one', () => {
      const { bif, metadata } = scoredSample();
      const context = projectScoredBifContext(bif, { scoringMetadata: metadata });

      // Every projected section corresponds to a real section in the BIF.
      for (const section of context.sections) {
        expect(bif.sections.some((s) => s.id === section.id)).toBe(true);
      }
      // Omitted sections carry a name and type only — no fields, no scores, no
      // fabricated value that could read as negative evidence.
      for (const omitted of context.omittedSections) {
        expect(omitted).not.toHaveProperty('fields');
        expect(omitted).not.toHaveProperty('confidenceScore');
        expect(Object.keys(omitted).sort()).toEqual(['name', 'type']);
      }
    });

    it('matches the scoring layer omitted list when metadata is supplied', () => {
      const { bif, metadata } = scoredSample();
      const context = projectScoredBifContext(bif, { scoringMetadata: metadata });

      expect(context.omittedSections.map((s) => s.type).sort()).toEqual(
        [...metadata.omittedSections].sort(),
      );
    });

    it('computes omitted sections structurally when no metadata is supplied', () => {
      const { bif, metadata } = scoredSample();
      const withMeta = projectScoredBifContext(bif, { scoringMetadata: metadata });
      const withoutMeta = projectScoredBifContext(bif);

      expect(withoutMeta.omittedSections.map((s) => s.type).sort()).toEqual(
        withMeta.omittedSections.map((s) => s.type).sort(),
      );
    });
  });

  describe('scoring explanations and metadata', () => {
    it('carries scoring warnings and reasons through when metadata is supplied', () => {
      const { bif, metadata } = scoredSample();
      const context = projectScoredBifContext(bif, { scoringMetadata: metadata });

      for (const warning of metadata.warnings) {
        expect(context.warnings).toContain(warning);
      }
      expect(context.reasons).toEqual([...metadata.reasons]);
      expect(context.metadata.scoringVersion).toBe(metadata.scoringVersion);
    });

    it('leaves warnings and reasons empty (Draft) when no metadata is supplied', () => {
      const { bif } = scoredSample();
      const context = projectScoredBifContext(bif);

      expect(context.reasons).toEqual([]);
      expect(context.warnings).toEqual([]);
      expect(context.metadata.scoringVersion).toBeUndefined();
    });

    it('reports coverage counts consistent with the projection', () => {
      const { bif, metadata } = scoredSample();
      const context = projectScoredBifContext(bif, { scoringMetadata: metadata });

      expect(context.metadata.presentSectionCount).toBe(context.sections.length);
      expect(context.metadata.omittedSectionCount).toBe(context.omittedSections.length);
      expect(context.metadata.canonicalSectionCount).toBe(BIF_SECTIONS.length);
      expect(context.metadata.populatedFieldCount).toBe(
        context.sections.reduce((sum, s) => sum + s.fields.length, 0),
      );
    });
  });

  describe('structural validation', () => {
    it('throws on a null input', () => {
      expect(() =>
        projectScoredBifContext(null as unknown as BusinessIntelligenceFramework),
      ).toThrow(/requires a BusinessIntelligenceFramework/);
    });

    it('throws when sections is not an array', () => {
      const { bif } = scoredSample();
      const broken = { ...bif, sections: undefined as unknown as [] };
      expect(() => projectScoredBifContext(broken)).toThrow(/sections to be an array/);
    });

    it('throws when a section has no fields array', () => {
      const { bif } = scoredSample();
      const firstSection = bif.sections[0];
      expect(firstSection).toBeDefined();
      const broken: BusinessIntelligenceFramework = {
        ...bif,
        sections: [{ ...firstSection!, fields: undefined as unknown as [] }],
      };
      expect(() => projectScoredBifContext(broken)).toThrow(/fields\[\] on every section/);
    });
  });

  describe('package entrypoint', () => {
    it('exports the projection API from the package index', () => {
      expect(typeof packageEntrypoint.projectScoredBifContext).toBe('function');
      expect(packageEntrypoint.SCORED_BIF_CONTEXT_VERSION).toBe(SCORED_BIF_CONTEXT_VERSION);
      expect(packageEntrypoint.scoredBifContextSchema).toBeDefined();

      const { bif, metadata } = scoredSample();
      const context = packageEntrypoint.projectScoredBifContext(bif, {
        scoringMetadata: metadata,
      });
      expect(context.bifId).toBe(bif.id);
    });

    it('projects a hand-built minimal Draft BIF (no discovery pipeline)', () => {
      const minimal: BusinessIntelligenceFramework = {
        id: 'bif-minimal',
        organizationId: 'org-x',
        version: 1,
        status: BIFStatus.Draft,
        sections: [],
        confidenceScore: 0,
        completenessScore: 0,
        createdAt: CONSTRUCTED_AT,
        updatedAt: CONSTRUCTED_AT,
        lastSyncedAt: CONSTRUCTED_AT,
      };
      const context = projectScoredBifContext(minimal);

      expect(context.sections).toEqual([]);
      expect(context.omittedSections.map((s) => s.type)).toEqual(BIF_SECTIONS.map((d) => d.type));
      expect(
        context.omittedSections.every((s) => Object.values(SectionType).includes(s.type)),
      ).toBe(true);
    });
  });
});
