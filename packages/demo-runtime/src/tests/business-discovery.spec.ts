import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  SAMPLE_BUSINESS_DISCOVERY_PROFILE,
  businessDiscoveryProfileSchema,
  produceScoredBifContext,
} from '@age/business-discovery-contracts';
import { runBusinessDiscoveryIntake } from '../business-discovery';
import { DEMO_SCENARIO_METADATA } from '../demo-scenario-metadata';
import { DEMO_BUSINESS_DISCOVERY_PROFILE } from '../demo-profile';
import { runAllCapabilities } from '../capabilities';

/**
 * Business Discovery is an upstream *intake* stage of the demo — it captures and
 * normalizes business context. It is deliberately NOT a capability run: it
 * produces no decision objects, so it never enters the capability approval
 * model. These tests pin that separation, the summary contents, and the
 * ADR-0038 / ADR-0039 mapping-path rules.
 */

const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const INTAKE_SOURCE = readFileSync(join(MODULE_DIRECTORY, '..', 'business-discovery.ts'), 'utf8');
/** The demo's single ScoredBifContext production point (ADR-0047 D2). */
const PRODUCER_SOURCE = readFileSync(join(MODULE_DIRECTORY, '..', 'scored-bif-context.ts'), 'utf8');
const SCENARIO_SOURCE = readFileSync(
  join(MODULE_DIRECTORY, '..', 'demo-scenario-metadata.ts'),
  'utf8',
);

/** Doc comments legitimately name Path A while saying it is no longer used. */
function withoutComments(source: string): string {
  return source.replace(/\/\*\*[\s\S]*?\*\/|\/\/.*$/gm, '');
}

describe('Business Discovery demo intake', () => {
  it('loads the sample profile and reports its identity', () => {
    const summary = runBusinessDiscoveryIntake(
      DEMO_BUSINESS_DISCOVERY_PROFILE,
      DEMO_SCENARIO_METADATA,
    );
    expect(summary.profileId).toBe(SAMPLE_BUSINESS_DISCOVERY_PROFILE.id);
    expect(summary.businessName).toBe(SAMPLE_BUSINESS_DISCOVERY_PROFILE.businessName);
  });

  it('validates the sample profile against businessDiscoveryProfileSchema', () => {
    const summary = runBusinessDiscoveryIntake(
      DEMO_BUSINESS_DISCOVERY_PROFILE,
      DEMO_SCENARIO_METADATA,
    );
    expect(summary.profileSchemaValid).toBe(true);
    // Independent confirmation that the flag is not merely hard-coded.
    expect(
      businessDiscoveryProfileSchema.safeParse(SAMPLE_BUSINESS_DISCOVERY_PROFILE).success,
    ).toBe(true);
  });

  it('includes the questionnaire validation result for the default questionnaire', () => {
    const summary = runBusinessDiscoveryIntake(
      DEMO_BUSINESS_DISCOVERY_PROFILE,
      DEMO_SCENARIO_METADATA,
    );
    expect(summary.questionnaireId).toBe(DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE.id);
    expect(summary.questionnaireVersion).toBe(DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE.version);
    expect(summary.questionnaireValid).toBe(true);
    expect(summary.missingRequiredCount).toBe(0);
    expect(summary.criticalGapCount).toBe(0);
  });

  it('reports the canonical sections Path B populated and those it omitted', () => {
    const summary = runBusinessDiscoveryIntake(
      DEMO_BUSINESS_DISCOVERY_PROFILE,
      DEMO_SCENARIO_METADATA,
    );

    // The honest Path B result on the sample profile: 7 of the 12 canonical BIF
    // sections are populated and 5 are omitted. Path A previously reported 8
    // locally-invented grouping keys and no omissions at all.
    expect(summary.presentSectionTypes).toEqual([
      'organization_identity',
      'vision_strategy',
      'products_services',
      'icp_personas',
      'market_competition',
      'brand_system',
      'gtm_system',
    ]);
    expect(summary.omittedSectionTypes).toHaveLength(5);
    expect(summary.presentSectionTypes.length + summary.omittedSectionTypes.length).toBe(12);

    // Omitted sections are reported as absent, never invented into present ones.
    for (const type of summary.omittedSectionTypes) {
      expect(summary.presentSectionTypes).not.toContain(type);
    }
  });

  it('reports the intake and BIF score pairs separately, and never conflates them', () => {
    const summary = runBusinessDiscoveryIntake(
      DEMO_BUSINESS_DISCOVERY_PROFILE,
      DEMO_SCENARIO_METADATA,
    );

    // The honesty proof, pinned. A thoroughly captured interview (97/63) still
    // yields a sparse Draft BIF (12/17), because discovery covers only part of
    // the BIF surface. If a future change makes either pair drift toward the
    // other, this fails rather than quietly flattering the result.
    expect(summary.discoveryCompletenessScore).toBe(97);
    expect(summary.discoveryConfidenceScore).toBe(63);
    expect(summary.bifCompletenessScore).toBe(12);
    expect(summary.bifConfidenceScore).toBe(17);

    // The two metrics in each pair are distinct measurements, never copies.
    expect(summary.bifCompletenessScore).not.toBe(summary.discoveryCompletenessScore);
    expect(summary.bifConfidenceScore).not.toBe(summary.discoveryConfidenceScore);

    // Reported, never acted on: status stays Draft.
    expect(summary.bifStatus).toBe('Draft');
  });

  it('reads its four scores straight from the mapper — the demo computes no score of its own', () => {
    const summary = runBusinessDiscoveryIntake(
      DEMO_BUSINESS_DISCOVERY_PROFILE,
      DEMO_SCENARIO_METADATA,
    );
    const { context, mappingMetadata } = produceScoredBifContext(
      SAMPLE_BUSINESS_DISCOVERY_PROFILE,
      {
        organizationId: DEMO_SCENARIO_METADATA.organizationId,
        constructedAt: DEMO_SCENARIO_METADATA.constructedAt,
        changedBy: DEMO_SCENARIO_METADATA.changedBy,
      },
    );

    expect(summary.discoveryCompletenessScore).toBe(mappingMetadata.discoveryCompletenessScore);
    expect(summary.discoveryConfidenceScore).toBe(mappingMetadata.discoveryConfidenceScore);
    expect(summary.bifCompletenessScore).toBe(context.bifCompletenessScore);
    expect(summary.bifConfidenceScore).toBe(context.bifConfidenceScore);
    expect(summary.bifStatus).toBe(String(context.bifStatus));
  });

  it('matches produceScoredBifContext called directly — the demo adds no mapping of its own', () => {
    const summary = runBusinessDiscoveryIntake(
      DEMO_BUSINESS_DISCOVERY_PROFILE,
      DEMO_SCENARIO_METADATA,
    );
    const { context } = produceScoredBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE, {
      organizationId: DEMO_SCENARIO_METADATA.organizationId,
      constructedAt: DEMO_SCENARIO_METADATA.constructedAt,
      changedBy: DEMO_SCENARIO_METADATA.changedBy,
    });

    expect(summary.presentSectionTypes).toEqual(context.sections.map((s) => String(s.type)));
    expect(summary.omittedSectionTypes).toEqual(context.omittedSections.map((s) => String(s.type)));
    // The BIF is never promoted by the demo.
    expect(context.bifStatus).toBe('Draft');
  });

  it('reports compact counts only — no full profile payload is exposed', () => {
    const summary = runBusinessDiscoveryIntake(
      DEMO_BUSINESS_DISCOVERY_PROFILE,
      DEMO_SCENARIO_METADATA,
    );
    expect(summary.evidenceReferenceCount).toBe(
      SAMPLE_BUSINESS_DISCOVERY_PROFILE.evidenceSources.length,
    );
    expect(summary.assumptionCount).toBe(SAMPLE_BUSINESS_DISCOVERY_PROFILE.assumptions.length);
    expect(summary.goalCount).toBe(SAMPLE_BUSINESS_DISCOVERY_PROFILE.goals.length);
    expect(summary.offeringCount).toBe(SAMPLE_BUSINESS_DISCOVERY_PROFILE.offerings.length);
    expect(summary.customerSegmentCount).toBe(SAMPLE_BUSINESS_DISCOVERY_PROFILE.segments.length);
    expect(summary.competitorCount).toBe(SAMPLE_BUSINESS_DISCOVERY_PROFILE.competitors.length);

    // Compactness guard: the summary carries scalars/keys only — never nested
    // profile objects (segment/offering/evidence bodies, answers, URLs).
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain('http');
    for (const [key, value] of Object.entries(summary)) {
      const isScalar =
        typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
      const isStringList = Array.isArray(value) && value.every((v) => typeof v === 'string');
      expect(isScalar || isStringList, `summary.${key} must be a scalar or string list`).toBe(true);
    }
  });

  it('is deterministic across runs', () => {
    expect(
      runBusinessDiscoveryIntake(DEMO_BUSINESS_DISCOVERY_PROFILE, DEMO_SCENARIO_METADATA),
    ).toEqual(runBusinessDiscoveryIntake(DEMO_BUSINESS_DISCOVERY_PROFILE, DEMO_SCENARIO_METADATA));
  });

  it('does not mutate the sample profile fixture', () => {
    const before = JSON.stringify(SAMPLE_BUSINESS_DISCOVERY_PROFILE);
    runBusinessDiscoveryIntake(DEMO_BUSINESS_DISCOVERY_PROFILE, DEMO_SCENARIO_METADATA);
    runBusinessDiscoveryIntake(DEMO_BUSINESS_DISCOVERY_PROFILE, DEMO_SCENARIO_METADATA);
    expect(JSON.stringify(SAMPLE_BUSINESS_DISCOVERY_PROFILE)).toBe(before);
  });

  it('leaves the existing six-capability demo output completely intact', async () => {
    runBusinessDiscoveryIntake(DEMO_BUSINESS_DISCOVERY_PROFILE, DEMO_SCENARIO_METADATA);
    const reports = await runAllCapabilities();
    expect(reports).toHaveLength(6);
    expect(reports.map((r) => r.name)).toEqual([
      'Intelligence',
      'Market Discovery',
      'Growth',
      'Authority',
      'Operations',
      'Revenue',
    ]);
    const pending = reports.reduce((sum, r) => sum + r.acceptedItems.length, 0);
    expect(pending).toBe(6);
  });

  it('produces no decision objects — intake never enters the approval model', () => {
    const summary = runBusinessDiscoveryIntake(
      DEMO_BUSINESS_DISCOVERY_PROFILE,
      DEMO_SCENARIO_METADATA,
    );
    expect(summary).not.toHaveProperty('acceptedItems');
    expect(summary).not.toHaveProperty('acceptedCount');
    expect(summary).not.toHaveProperty('executionResult');
  });
});

describe('ADR-0039 — demo scenario metadata is explicit and demo-owned', () => {
  it('supplies exactly the three values canonical Path B requires', () => {
    expect(Object.keys(DEMO_SCENARIO_METADATA).sort()).toEqual([
      'changedBy',
      'constructedAt',
      'organizationId',
    ]);
    expect(DEMO_SCENARIO_METADATA.organizationId.trim().length).toBeGreaterThan(0);
    expect(DEMO_SCENARIO_METADATA.changedBy.trim().length).toBeGreaterThan(0);
    expect(Number.isNaN(DEMO_SCENARIO_METADATA.constructedAt.getTime())).toBe(false);
  });

  it('declares a fixed scenario time, never a wall-clock read', () => {
    expect(withoutComments(SCENARIO_SOURCE)).not.toMatch(/new Date\(\s*\)/);
    expect(withoutComments(SCENARIO_SOURCE)).not.toMatch(/Date\.now\(/);
    expect(DEMO_SCENARIO_METADATA.constructedAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('labels itself demo scenario metadata, not production tenant identity', () => {
    expect(SCENARIO_SOURCE).toMatch(/NOT PRODUCTION TENANT IDENTITY/i);
    expect(SCENARIO_SOURCE).toMatch(/ADR-0039/);
  });

  it('is passed in, not reached for — neither module invents any of the three', () => {
    // ⚠️ ADR-0047 D2 moved the three scenario reads one module down, into the
    // demo's single production point. The property this test defends is
    // unchanged, so it is asserted WHERE THE VALUES ARE NOW READ rather than
    // relaxed: a guard left pointing at a module that no longer does the thing
    // would pass by scanning the wrong file.
    for (const source of [withoutComments(INTAKE_SOURCE), withoutComments(PRODUCER_SOURCE)]) {
      expect(source).not.toMatch(/DEMO_SCENARIO_METADATA/);
      expect(source).not.toMatch(/Date\.now\(/);
      expect(source).not.toMatch(/Math\.random\(/);
    }

    // Every one of the three reaches the mapper from the parameter.
    const producer = withoutComments(PRODUCER_SOURCE);
    expect(producer).toMatch(/scenario\.organizationId/);
    expect(producer).toMatch(/scenario\.constructedAt/);
    expect(producer).toMatch(/scenario\.changedBy/);

    // The intake stage itself still reaches for nothing at all: it takes the
    // scenario and hands it straight on.
    expect(withoutComments(INTAKE_SOURCE)).not.toMatch(/new Date\(/);
    // The producer's ONE `new Date(` is a defensive COPY of the scenario's own
    // frozen time (`Object.freeze` is shallow), never a wall-clock read — so it
    // is pinned to that exact shape rather than merely permitted.
    expect(producer).toMatch(/new Date\(scenario\.constructedAt\.getTime\(\)\)/);
    expect(producer.match(/new Date\(/g)).toHaveLength(1);
  });

  it('uses canonical Path B, through the single demo production point', () => {
    // The legacy Path A mapper was retired outright (ADR-0039 D7), and its
    // absence is now asserted repository-wide in
    // `@age/business-discovery-contracts` rather than restated here.
    //
    // ADR-0047 D2: intake no longer calls the mapper directly — it goes through
    // `produceDemoScoredBifContext`, so the demo assembles the three Path B
    // values in exactly one place and the readiness stage cannot assemble a
    // second, silently-divergent set.
    expect(withoutComments(INTAKE_SOURCE)).toMatch(/produceDemoScoredBifContext/);
    expect(withoutComments(PRODUCER_SOURCE)).toMatch(/produceScoredBifContext\(/);
  });

  it('changing the scenario changes only what the scenario owns', () => {
    const other = {
      organizationId: 'other-demo-organization',
      constructedAt: new Date('2025-06-15T12:30:00.000Z'),
      changedBy: 'other-demo-operator',
    };

    const baseline = runBusinessDiscoveryIntake(
      DEMO_BUSINESS_DISCOVERY_PROFILE,
      DEMO_SCENARIO_METADATA,
    );
    const alternative = runBusinessDiscoveryIntake(DEMO_BUSINESS_DISCOVERY_PROFILE, other);

    // The metadata is genuinely threaded through, but it describes provenance —
    // it must not change which sections the discovery input can populate.
    expect(alternative.presentSectionTypes).toEqual(baseline.presentSectionTypes);
    expect(alternative.omittedSectionTypes).toEqual(baseline.omittedSectionTypes);
  });

  /**
   * ADR-0049 D4 — the test this whole slice exists for.
   *
   * Until the profile became a parameter, every output above was a function of
   * one module constant, and no test in the repository could tell "derived from
   * the profile" apart from "hard-coded": with a fixed input the two are
   * observationally identical. These two tests are what make the pipeline —
   * and the ADR-0047/0048 readiness stage downstream of it — falsifiable.
   *
   * ⚠️ Do not weaken these to `toBeDefined()` or to a shape check. The
   * assertions are `not.toBe` / `not.toEqual` on purpose: what is being proven
   * is that a DIFFERENT business gets a DIFFERENT answer.
   */
  describe('the profile is an input, not a constant (ADR-0049 D4)', () => {
    /**
     * A materially sparser business: an early-stage profile that answered the
     * identity questions and little else. Built immutably from the sample so it
     * stays a valid `BusinessDiscoveryProfile` (the schema explicitly permits a
     * partial early-stage profile) while carrying far less than the sample does.
     */
    const SPARSE_PROFILE = {
      ...SAMPLE_BUSINESS_DISCOVERY_PROFILE,
      id: 'sparse-early-stage-profile',
      businessName: 'Eastwind Bookkeeping',
      segments: [],
      offerings: [],
      competitors: [],
      goals: [],
      evidenceSources: [],
      assumptions: [],
      fieldEvidence: undefined,
    };

    it('a different profile produces different scores', () => {
      const baseline = runBusinessDiscoveryIntake(
        DEMO_BUSINESS_DISCOVERY_PROFILE,
        DEMO_SCENARIO_METADATA,
      );
      const sparse = runBusinessDiscoveryIntake(SPARSE_PROFILE, DEMO_SCENARIO_METADATA);

      // Identity tracks the profile it was given, not a constant.
      expect(sparse.profileId).toBe('sparse-early-stage-profile');
      expect(sparse.businessName).toBe('Eastwind Bookkeeping');
      expect(sparse.profileId).not.toBe(baseline.profileId);

      // The sparser business is scored differently. At least one score in each
      // pair must move — asserting the whole four-tuple differs would be a
      // weaker claim that a single shared multiplier could satisfy.
      expect(sparse.discoveryConfidenceScore).not.toBe(baseline.discoveryConfidenceScore);
      expect(sparse.bifCompletenessScore).not.toBe(baseline.bifCompletenessScore);

      // ⚠️ Sparser input means a sparser BIF — a limitation, never negative
      // evidence and never an error (ADR-0026 D4). The run still succeeds and
      // the status is still Draft.
      expect(sparse.profileSchemaValid).toBe(true);
      expect(sparse.bifStatus).toBe('Draft');

      // The counts are read off the supplied profile, not off the sample.
      expect(sparse.offeringCount).toBe(0);
      expect(sparse.customerSegmentCount).toBe(0);
      expect(sparse.evidenceReferenceCount).toBe(0);
    });

    it('a different profile changes which canonical BIF sections can be populated', () => {
      const baseline = runBusinessDiscoveryIntake(
        DEMO_BUSINESS_DISCOVERY_PROFILE,
        DEMO_SCENARIO_METADATA,
      );
      const sparse = runBusinessDiscoveryIntake(SPARSE_PROFILE, DEMO_SCENARIO_METADATA);

      // The section split responds to the input. This is the assertion that the
      // scenario-metadata test above deliberately CANNOT make: provenance must
      // not change the section split, and the profile must.
      expect(sparse.presentSectionTypes).not.toEqual(baseline.presentSectionTypes);
      expect(sparse.presentSectionTypes.length).toBeLessThan(baseline.presentSectionTypes.length);

      // Still the full canonical surface, still accounted for — nothing is
      // invented to fill the gap, and omissions stay first-class.
      expect(sparse.presentSectionTypes.length + sparse.omittedSectionTypes.length).toBe(12);
      for (const type of sparse.omittedSectionTypes) {
        expect(sparse.presentSectionTypes).not.toContain(type);
      }
    });

    it('the intake stage reads no profile from module scope', () => {
      // The guard that keeps the parameter a parameter. If a future change
      // reintroduces a module-level default, the two tests above would keep
      // passing while the call site stopped having to say whose business this
      // is — which is exactly the coupling ADR-0049 D2 removed.
      const intake = withoutComments(INTAKE_SOURCE);
      expect(intake).not.toMatch(/SAMPLE_BUSINESS_DISCOVERY_PROFILE/);
      expect(intake).not.toMatch(/DEMO_BUSINESS_DISCOVERY_PROFILE/);
      expect(withoutComments(PRODUCER_SOURCE)).not.toMatch(/SAMPLE_BUSINESS_DISCOVERY_PROFILE/);
      // Both stages take the profile as a parameter and hand it straight on.
      expect(intake).toMatch(/profile: BusinessDiscoveryProfile/);
      expect(withoutComments(PRODUCER_SOURCE)).toMatch(/profile: BusinessDiscoveryProfile/);
      expect(withoutComments(PRODUCER_SOURCE)).toMatch(/produceScoredBifContext\(profile,/);
    });
  });
});
