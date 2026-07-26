import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BIF_SECTIONS } from '@age/bif';
import * as packageEntrypoint from '../index';
import { produceScoredBifContext } from '../produce-scored-bif-context';
import { projectScoredBifContext, scoredBifContextSchema } from '../scored-bif-context';
import { scoreBusinessIntelligenceFramework } from '../bif-confidence-scoring';
import { mapBusinessDiscoveryToBifDraft } from '../business-discovery-to-bif';
import { SAMPLE_BUSINESS_DISCOVERY_PROFILE } from '../sample-profile';
import type { BusinessDiscoveryProfile } from '../business-discovery-profile';

const CONSTRUCTED_AT = new Date('2026-07-15T09:30:00.000Z');

const OPTIONS = {
  organizationId: 'org-northwind',
  constructedAt: CONSTRUCTED_AT,
  changedBy: 'analyst@example.com',
} as const;

const MODULE_SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'produce-scored-bif-context.ts'),
  'utf8',
);

/** Comments legitimately name things the executable code must not touch. */
const EXECUTABLE_SOURCE = MODULE_SOURCE.replace(/\/\*\*[\s\S]*?\*\/|\/\/.*$/gm, '');

/** The chain exactly as the nine hand-rolled test callers write it today. */
function handRolledChain() {
  const { bif, metadata: mappingMetadata } = mapBusinessDiscoveryToBifDraft(
    SAMPLE_BUSINESS_DISCOVERY_PROFILE,
    OPTIONS,
  );
  const { bif: scored, metadata: scoringMetadata } = scoreBusinessIntelligenceFramework(bif);
  return {
    context: projectScoredBifContext(scored, { scoringMetadata }),
    mappingMetadata,
    scoringMetadata,
  };
}

describe('produceScoredBifContext', () => {
  describe('it produces exactly what the hand-rolled chain produces', () => {
    it('returns a context identical to the three-call chain for the sample profile', () => {
      const produced = produceScoredBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS);

      expect(produced.context).toEqual(handRolledChain().context);
    });

    it('returns a context that satisfies the published schema', () => {
      const { context } = produceScoredBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS);

      expect(() => scoredBifContextSchema.parse(context)).not.toThrow();
    });

    it('pins the delivered sample scores so a silent scoring change fails here', () => {
      const { context } = produceScoredBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS);

      expect(context.bifConfidenceScore).toBe(17);
      expect(context.bifCompletenessScore).toBe(12);
      expect(context.sections).toHaveLength(7);
      expect(context.omittedSections).toHaveLength(5);
    });

    it('is deterministic — two calls on the same input agree exactly', () => {
      expect(produceScoredBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS)).toEqual(
        produceScoredBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS),
      );
    });

    it('does not mutate the profile it is given', () => {
      const before = JSON.stringify(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
      produceScoredBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS);

      expect(JSON.stringify(SAMPLE_BUSINESS_DISCOVERY_PROFILE)).toBe(before);
    });
  });

  describe('scoring metadata is threaded through, never recomputed (D5)', () => {
    it('returns the scorer’s own metadata object contents unchanged', () => {
      const produced = produceScoredBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS);

      expect(produced.scoringMetadata).toEqual(handRolledChain().scoringMetadata);
    });

    it('projects with the scorer’s omissions, not a structurally recomputed set', () => {
      const produced = produceScoredBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS);
      const projectedTypes = produced.context.omittedSections.map((section) => section.type).sort();

      expect(projectedTypes).toEqual([...produced.scoringMetadata.omittedSections].sort());
    });

    it('passes scoringMetadata into the projector in the source, rather than omitting it', () => {
      expect(EXECUTABLE_SOURCE).toMatch(/projectScoredBifContext\([\s\S]*?scoringMetadata/);
    });
  });

  describe('both metadata sets survive (D6)', () => {
    it('returns the mapper metadata alongside the context', () => {
      const produced = produceScoredBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS);

      expect(produced.mappingMetadata).toEqual(handRolledChain().mappingMetadata);
    });

    it('keeps the two completeness scores distinct and unmixed (ADR-0025)', () => {
      const { context, mappingMetadata } = produceScoredBifContext(
        SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        OPTIONS,
      );

      expect(mappingMetadata.discoveryCompletenessScore).toBe(97);
      expect(context.bifCompletenessScore).toBe(mappingMetadata.bifPopulationCompletenessScore);
      expect(context.bifCompletenessScore).not.toBe(mappingMetadata.discoveryCompletenessScore);
    });

    it('never writes the discovery input confidence into BIF confidence', () => {
      const { context, mappingMetadata } = produceScoredBifContext(
        SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        OPTIONS,
      );

      expect(mappingMetadata.discoveryConfidenceScore).toBe(63);
      expect(context.bifConfidenceScore).not.toBe(mappingMetadata.discoveryConfidenceScore);
    });

    it('reports the scoring version the scorer stamped', () => {
      const produced = produceScoredBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS);

      expect(produced.context.metadata.scoringVersion).toBe(
        produced.scoringMetadata.scoringVersion,
      );
    });
  });

  describe('every caller-supplied value passes through unchanged (D4)', () => {
    it('forwards the whole mapper option set untouched, adding and defaulting nothing', () => {
      expect(EXECUTABLE_SOURCE).toMatch(
        /const \{ sectionDefinitions, \.\.\.mapperOptions \} = options;/,
      );
      expect(EXECUTABLE_SOURCE).toMatch(
        /mapBusinessDiscoveryToBifDraft\(\s*profile,\s*mapperOptions,?\s*\)/,
      );
    });

    /**
     * FINDING, pinned rather than papered over: `organizationId` reaches the BIF
     * but is deliberately NOT projected into `ScoredBifContext`. That is the
     * right shape — ADR-0030 says tenancy scope comes from `ClientContext` and
     * is never inferred from a payload — so a consumer cannot read scope out of
     * a context even if it wanted to.
     */
    it('does not project organizationId into the context — scope never rides the payload', () => {
      const elsewhere = produceScoredBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE, {
        ...OPTIONS,
        organizationId: 'org-elsewhere',
      });

      expect(Object.keys(elsewhere.context)).not.toContain('organizationId');
      expect(elsewhere.context).toEqual(handRolledChain().context);
    });

    it('uses the caller’s bifId when supplied', () => {
      const { context } = produceScoredBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE, {
        ...OPTIONS,
        bifId: 'bif-chosen-by-caller',
      });

      expect(context.bifId).toBe('bif-chosen-by-caller');
    });

    it('leaves the mapper’s own bifId default in place when the caller omits it', () => {
      const { context } = produceScoredBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE, OPTIONS);

      expect(context.bifId).toBe(handRolledChain().context.bifId);
    });

    /**
     * `constructedAt` sets every BIF `Date`, but the projection carries no dates
     * at all, so its effect is invisible in the returned context. It is still
     * required, still caller-supplied, and still never defaulted here — proven
     * at the source, because there is nothing to observe in the output.
     */
    it('requires constructedAt from the caller and never substitutes a clock', () => {
      const other = new Date('2020-01-02T03:04:05.000Z');
      const produced = produceScoredBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE, {
        ...OPTIONS,
        constructedAt: other,
      });

      expect(produced.context).toEqual(handRolledChain().context);
      expect(EXECUTABLE_SOURCE).not.toMatch(/constructedAt/);
    });

    it('passes sectionDefinitions to both the scorer and the projector', () => {
      const narrowed = BIF_SECTIONS.slice(0, 3);
      const { context } = produceScoredBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE, {
        ...OPTIONS,
        sectionDefinitions: narrowed,
      });

      expect(context.metadata.canonicalSectionCount).toBe(3);
    });

    it('does not leak sectionDefinitions into the mapper options', () => {
      expect(EXECUTABLE_SOURCE).toMatch(
        /const \{ sectionDefinitions, \.\.\.mapperOptions \} = options;/,
      );
      expect(EXECUTABLE_SOURCE).toMatch(
        /mapBusinessDiscoveryToBifDraft\(\s*profile,\s*mapperOptions/,
      );
    });
  });

  describe('it reads no clock, no id and no randomness (D3)', () => {
    it.each([
      ['new Date(', /new Date\(/],
      ['Date.now(', /Date\.now\(/],
      ['Math.random(', /Math\.random\(/],
      ['performance.now(', /performance\.now\(/],
      ['fetch(', /fetch\(/],
      ['node:fs', /node:fs/],
      ['process.env', /process\.env/],
      ['crypto', /crypto/],
    ])('never uses %s', (_label, pattern) => {
      expect(EXECUTABLE_SOURCE).not.toMatch(pattern);
    });
  });

  describe('it does not know persistence exists (D7)', () => {
    it.each([
      ['@age/scored-bif-snapshot-persistence', /@age\/scored-bif-snapshot-persistence/],
      ['@age/persistence', /@age\/persistence/],
      ['@prisma/client', /@prisma\/client/],
      ['snapshotId', /snapshotId/],
      ['capturedAt', /capturedAt/],
      ['ScoredBifSnapshot', /ScoredBifSnapshot/],
      ['ClientContext', /ClientContext/],
    ])('never names %s', (_label, pattern) => {
      expect(EXECUTABLE_SOURCE).not.toMatch(pattern);
    });

    it('imports only from @age/bif and its own package', () => {
      const specifiers = [...MODULE_SOURCE.matchAll(/from '([^']+)'/g)].map(
        (match) => match[1] ?? '',
      );
      const external = specifiers.filter((specifier) => !specifier.startsWith('.'));

      expect([...new Set(external)]).toEqual(['@age/bif']);
    });
  });

  describe('invalid input still fails at the mapper’s existing guard', () => {
    it('does not swallow the mapper’s rejection', () => {
      const invalid = { ...SAMPLE_BUSINESS_DISCOVERY_PROFILE, sections: null };

      expect(() =>
        produceScoredBifContext(invalid as unknown as BusinessDiscoveryProfile, OPTIONS),
      ).toThrow();
    });

    it('contains no try/catch of its own', () => {
      expect(EXECUTABLE_SOURCE).not.toMatch(/\btry\b/);
      expect(EXECUTABLE_SOURCE).not.toMatch(/\bcatch\b/);
    });
  });

  describe('it changes nothing it chains (D9)', () => {
    it('exports the three chained functions from the barrel, still independently callable', () => {
      expect(typeof packageEntrypoint.mapBusinessDiscoveryToBifDraft).toBe('function');
      expect(typeof packageEntrypoint.scoreBusinessIntelligenceFramework).toBe('function');
      expect(typeof packageEntrypoint.projectScoredBifContext).toBe('function');
    });

    it('exports the new function from the barrel', () => {
      expect(packageEntrypoint.produceScoredBifContext).toBe(produceScoredBifContext);
    });

    it('adds exactly one runtime export to the barrel for this slice', () => {
      const added = Object.keys(packageEntrypoint).filter((name) =>
        name.startsWith('produceScoredBif'),
      );

      expect(added).toEqual(['produceScoredBifContext']);
    });
  });
});
