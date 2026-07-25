import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BIFStatus, SectionType, type BusinessIntelligenceFramework } from '@age/bif';
import * as packageEntrypoint from '../index';
import {
  SCORED_BIF_SNAPSHOT_VERSION,
  fromScoredBifSnapshot,
  scoredBifSnapshotSchema,
  serializeScoredBifSnapshot,
  toScoredBifSnapshot,
  type ScoredBifSnapshot,
} from '../scored-bif-snapshot';
import { projectScoredBifContext, type ScoredBifContext } from '../scored-bif-context';
import { scoreBusinessIntelligenceFramework } from '../bif-confidence-scoring';
import { mapBusinessDiscoveryToBifDraft } from '../business-discovery-to-bif';
import { SAMPLE_BUSINESS_DISCOVERY_PROFILE } from '../sample-profile';

const CONSTRUCTED_AT = new Date('2026-07-15T09:30:00.000Z');

const MAPPER_OPTIONS = {
  organizationId: 'org-northwind',
  constructedAt: CONSTRUCTED_AT,
  changedBy: 'analyst@example.com',
} as const;

/** The real scored sample Draft BIF, built from the delivered pipeline. */
function scoredSample() {
  const { bif } = mapBusinessDiscoveryToBifDraft(SAMPLE_BUSINESS_DISCOVERY_PROFILE, MAPPER_OPTIONS);
  return scoreBusinessIntelligenceFramework(bif);
}

/** The projected context under test — the thing a snapshot preserves. */
function sampleContext(): ScoredBifContext {
  const { bif, metadata } = scoredSample();
  return projectScoredBifContext(bif, { scoringMetadata: metadata });
}

/** A full round trip through the serialized form, exactly as a store would do it. */
function roundTrip(context: ScoredBifContext): ScoredBifContext {
  const json = serializeScoredBifSnapshot(toScoredBifSnapshot(context));
  return fromScoredBifSnapshot(JSON.parse(json));
}

describe('ScoredBifSnapshot codec', () => {
  describe('snapshot construction', () => {
    it('wraps a projected context in a valid versioned envelope', () => {
      const snapshot = toScoredBifSnapshot(sampleContext());

      expect(() => scoredBifSnapshotSchema.parse(snapshot)).not.toThrow();
      expect(snapshot.snapshotVersion).toBe(SCORED_BIF_SNAPSHOT_VERSION);
    });

    it('does not mutate or rebuild the context it is given', () => {
      const context = sampleContext();
      const before = JSON.stringify(context);
      const snapshot = toScoredBifSnapshot(context);

      expect(snapshot.context).toBe(context);
      expect(JSON.stringify(context)).toBe(before);
    });

    it('rejects a structurally invalid context instead of repairing it', () => {
      const broken = { ...sampleContext(), sections: undefined } as unknown as ScoredBifContext;
      expect(() => toScoredBifSnapshot(broken)).toThrow(/valid ScoredBifContext/);
    });
  });

  describe('round trip over the real sample', () => {
    it('returns a context deeply equal to the original', () => {
      const context = sampleContext();
      expect(roundTrip(context)).toEqual(context);
    });

    it('preserves the root confidence and completeness scores exactly', () => {
      const context = sampleContext();
      const restored = roundTrip(context);

      // The pinned sample scores: root confidence 17, BIF completeness 12.
      expect(context.bifConfidenceScore).toBe(17);
      expect(context.bifCompletenessScore).toBe(12);
      expect(restored.bifConfidenceScore).toBe(context.bifConfidenceScore);
      expect(restored.bifCompletenessScore).toBe(context.bifCompletenessScore);
    });

    it('preserves every section score exactly, with no rounding or clamping', () => {
      const context = sampleContext();
      const restored = roundTrip(context);

      expect(restored.sections.length).toBe(context.sections.length);
      expect(context.sections.length).toBe(7);
      for (const [index, original] of context.sections.entries()) {
        const survived = restored.sections[index];
        expect(survived?.type).toBe(original.type);
        expect(survived?.confidenceScore).toBe(original.confidenceScore);
        expect(survived?.completenessScore).toBe(original.completenessScore);
      }
    });

    it('preserves section order — order is data, not formatting', () => {
      const context = sampleContext();
      expect(roundTrip(context).sections.map((section) => section.type)).toEqual(
        context.sections.map((section) => section.type),
      );
    });

    it('preserves per-field provenance (source and confidence) on every field', () => {
      const context = sampleContext();
      const restored = roundTrip(context);

      const originalFields = context.sections.flatMap((section) => section.fields);
      const restoredFields = restored.sections.flatMap((section) => section.fields);

      expect(originalFields.length).toBe(context.metadata.populatedFieldCount);
      expect(restoredFields.length).toBe(originalFields.length);
      for (const [index, field] of originalFields.entries()) {
        expect(restoredFields[index]?.key).toBe(field.key);
        expect(restoredFields[index]?.source).toBe(field.source);
        expect(restoredFields[index]?.confidence).toBe(field.confidence);
        expect(restoredFields[index]?.required).toBe(field.required);
        expect(restoredFields[index]?.type).toBe(field.type);
        expect(restoredFields[index]?.value).toEqual(field.value);
      }
    });

    it('preserves the carried scoring reasons and warnings verbatim', () => {
      const context = sampleContext();
      const restored = roundTrip(context);

      expect(restored.reasons).toEqual(context.reasons);
      expect(restored.warnings).toEqual(context.warnings);
      expect(restored.metadata.scoringVersion).toBe(context.metadata.scoringVersion);
    });

    it('preserves the context version stamp', () => {
      const context = sampleContext();
      expect(roundTrip(context).contextVersion).toBe(context.contextVersion);
    });

    it('carries the BIF status through without promoting it', () => {
      const context = sampleContext();
      const restored = roundTrip(context);

      expect(context.bifStatus).toBe(BIFStatus.Draft);
      expect(restored.bifStatus).toBe(BIFStatus.Draft);
    });
  });

  describe('non-fabrication: omitted sections stay omitted', () => {
    it('keeps the five omitted sample sections omitted across a round trip', () => {
      const context = sampleContext();
      const restored = roundTrip(context);

      expect(context.omittedSections.length).toBe(5);
      expect(restored.omittedSections.map((section) => section.type)).toEqual(
        context.omittedSections.map((section) => section.type),
      );
      expect(restored.metadata.omittedSectionCount).toBe(context.metadata.omittedSectionCount);
    });

    it('never materialises an omitted section into a present one', () => {
      const restored = roundTrip(sampleContext());
      const presentTypes = new Set<SectionType>(restored.sections.map((section) => section.type));

      for (const omitted of restored.omittedSections) {
        expect(
          presentTypes.has(omitted.type),
          `omitted section ${String(omitted.type)} must not appear in sections[]`,
        ).toBe(false);
      }
      expect(restored.sections.length + restored.omittedSections.length).toBe(
        restored.metadata.canonicalSectionCount,
      );
    });

    it('never invents a field on a restored section', () => {
      const context = sampleContext();
      const restored = roundTrip(context);

      for (const [index, original] of context.sections.entries()) {
        expect(restored.sections[index]?.fields.length).toBe(original.fields.length);
      }
    });

    it('leaves an absent optional absent rather than defaulting it', () => {
      const context = sampleContext();
      const withoutScoringVersion: ScoredBifContext = {
        ...context,
        metadata: { ...context.metadata, scoringVersion: undefined },
      };
      const restored = roundTrip(withoutScoringVersion);

      expect(restored.metadata.scoringVersion).toBeUndefined();
      expect(Object.prototype.hasOwnProperty.call(restored.metadata, 'scoringVersion')).toBe(false);
    });

    it('round-trips an empty context without inventing sections', () => {
      const empty: ScoredBifContext = {
        ...sampleContext(),
        sections: [],
        omittedSections: [],
        metadata: {
          presentSectionCount: 0,
          omittedSectionCount: 0,
          canonicalSectionCount: 0,
          populatedFieldCount: 0,
        },
      };
      const restored = roundTrip(empty);

      expect(restored.sections).toEqual([]);
      expect(restored.omittedSections).toEqual([]);
    });
  });

  describe('deterministic serialization', () => {
    it('produces a byte-identical string across repeated runs', () => {
      const context = sampleContext();
      const first = serializeScoredBifSnapshot(toScoredBifSnapshot(context));
      const second = serializeScoredBifSnapshot(toScoredBifSnapshot(context));

      expect(second).toBe(first);
    });

    it('produces a byte-identical string for two independently built contexts', () => {
      const first = serializeScoredBifSnapshot(toScoredBifSnapshot(sampleContext()));
      const second = serializeScoredBifSnapshot(toScoredBifSnapshot(sampleContext()));

      expect(second).toBe(first);
    });

    it('is insensitive to the property order of the input object', () => {
      const context = sampleContext();
      const reordered = {
        metadata: context.metadata,
        reasons: context.reasons,
        warnings: context.warnings,
        omittedSections: context.omittedSections,
        sections: context.sections,
        bifCompletenessScore: context.bifCompletenessScore,
        bifConfidenceScore: context.bifConfidenceScore,
        bifStatus: context.bifStatus,
        bifId: context.bifId,
        contextVersion: context.contextVersion,
      } as ScoredBifContext;

      expect(serializeScoredBifSnapshot(toScoredBifSnapshot(reordered))).toBe(
        serializeScoredBifSnapshot(toScoredBifSnapshot(context)),
      );
    });

    it('emits a different string when a score actually differs', () => {
      const context = sampleContext();
      const nudged: ScoredBifContext = { ...context, bifConfidenceScore: 18 };

      expect(serializeScoredBifSnapshot(toScoredBifSnapshot(nudged))).not.toBe(
        serializeScoredBifSnapshot(toScoredBifSnapshot(context)),
      );
    });
  });

  describe('values that cannot survive JSON are rejected, not mangled', () => {
    function contextWithFieldValue(value: unknown): ScoredBifContext {
      const context = sampleContext();
      const [first, ...rest] = context.sections;
      const [firstField, ...otherFields] = first!.fields;
      return {
        ...context,
        sections: [{ ...first!, fields: [{ ...firstField!, value }, ...otherFields] }, ...rest],
      };
    }

    it('rejects a Date, which JSON would return as a string', () => {
      expect(() => toScoredBifSnapshot(contextWithFieldValue(CONSTRUCTED_AT))).toThrow(/Date/);
    });

    it('rejects undefined, which JSON would silently drop', () => {
      expect(() => toScoredBifSnapshot(contextWithFieldValue({ nested: undefined }))).toThrow(
        /undefined/,
      );
    });

    it('rejects a non-finite number, which JSON would turn into null', () => {
      expect(() => toScoredBifSnapshot(contextWithFieldValue(Number.NaN))).toThrow(/non-finite/);
    });

    it('rejects a circular reference', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      expect(() => toScoredBifSnapshot(contextWithFieldValue(circular))).toThrow(/circular/);
    });

    it('rejects a class instance', () => {
      class Holder {
        readonly n = 1;
      }
      expect(() => toScoredBifSnapshot(contextWithFieldValue(new Holder()))).toThrow(
        /class instance/,
      );
    });

    it('accepts the plain JSON values the real sample actually contains', () => {
      expect(() => toScoredBifSnapshot(sampleContext())).not.toThrow();
      expect(() =>
        toScoredBifSnapshot(contextWithFieldValue({ a: ['x', 1, true, null] })),
      ).not.toThrow();
    });
  });

  describe('reading untrusted snapshots', () => {
    it('rejects a value that is not a snapshot at all', () => {
      for (const bad of [null, undefined, 42, 'snapshot', [], {}]) {
        expect(() => fromScoredBifSnapshot(bad)).toThrow(/valid ScoredBifSnapshot/);
      }
    });

    it('rejects a snapshot whose context is malformed', () => {
      const snapshot = toScoredBifSnapshot(sampleContext());
      const corrupted = {
        ...snapshot,
        context: { ...snapshot.context, bifConfidenceScore: 140 },
      };
      expect(() => fromScoredBifSnapshot(corrupted)).toThrow(/valid ScoredBifSnapshot/);
    });

    it('rejects a snapshot from a future major rather than guessing its meaning', () => {
      const snapshot: ScoredBifSnapshot = {
        ...toScoredBifSnapshot(sampleContext()),
        snapshotVersion: '2.0.0',
      };
      expect(() => fromScoredBifSnapshot(snapshot)).toThrow(/implements major 1/);
    });

    it('accepts a later minor of the same major', () => {
      const snapshot: ScoredBifSnapshot = {
        ...toScoredBifSnapshot(sampleContext()),
        snapshotVersion: '1.7.3',
      };
      expect(() => fromScoredBifSnapshot(snapshot)).not.toThrow();
    });

    it('rejects an unparseable version string', () => {
      const snapshot: ScoredBifSnapshot = {
        ...toScoredBifSnapshot(sampleContext()),
        snapshotVersion: 'latest',
      };
      expect(() => fromScoredBifSnapshot(snapshot)).toThrow(/implements major 1/);
    });
  });

  describe('determinism and purity', () => {
    function source(): string {
      const here = dirname(fileURLToPath(import.meta.url));
      return readFileSync(join(here, '..', 'scored-bif-snapshot.ts'), 'utf8');
    }

    function code(): string {
      return source()
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
        .join('\n');
    }

    it('reads no clock and no randomness', () => {
      for (const forbidden of ['new Date(', 'Date.now(', 'Math.random(', 'performance.now(']) {
        expect(code().includes(forbidden), `snapshot source must not contain ${forbidden}`).toBe(
          false,
        );
      }
    });

    it('performs no I/O of any kind — this is a codec, not persistence', () => {
      for (const forbidden of [
        'fetch(',
        'node:fs',
        'node:path',
        'process.env',
        'localStorage',
        '@prisma/client',
        '@age/persistence',
      ]) {
        expect(source().includes(forbidden), `snapshot source must not contain ${forbidden}`).toBe(
          false,
        );
      }
    });

    it('never promotes a BIF status', () => {
      expect(code().includes('BIFStatus.Active')).toBe(false);
      expect(code().includes('status =')).toBe(false);
    });
  });

  describe('package entrypoint', () => {
    it('exports the snapshot API from the package index', () => {
      expect(typeof packageEntrypoint.toScoredBifSnapshot).toBe('function');
      expect(typeof packageEntrypoint.fromScoredBifSnapshot).toBe('function');
      expect(typeof packageEntrypoint.serializeScoredBifSnapshot).toBe('function');
      expect(packageEntrypoint.SCORED_BIF_SNAPSHOT_VERSION).toBe(SCORED_BIF_SNAPSHOT_VERSION);
      expect(packageEntrypoint.scoredBifSnapshotSchema).toBeDefined();
    });

    it('round-trips a hand-built minimal context through the package entrypoint', () => {
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
      const context = packageEntrypoint.projectScoredBifContext(minimal);
      const json = packageEntrypoint.serializeScoredBifSnapshot(
        packageEntrypoint.toScoredBifSnapshot(context),
      );

      expect(packageEntrypoint.fromScoredBifSnapshot(JSON.parse(json))).toEqual(context);
    });
  });
});
