import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  Capability,
  CapabilityOutput,
  CapabilitySufficiencyState,
  ClientContext,
} from '@age/capability-kit';
import {
  SAMPLE_BUSINESS_DISCOVERY_PROFILE,
  mapBusinessDiscoveryToBifDraft,
  projectScoredBifContext,
  scoreBusinessIntelligenceFramework,
  type ScoredBifContext,
} from '@age/business-discovery-contracts';
import {
  REQUIRED_REVENUE_CONTEXT_SECTION_TYPES,
  REVENUE_CONTEXT_READINESS_THRESHOLDS,
  REVENUE_CONTEXT_READINESS_VERSION,
  assessRevenueContextReadiness,
} from '../../processing/assess-revenue-context-readiness';
import { RevenueCapability } from '../../revenue-capability';
import { REVENUE_CAPABILITY_ENTRY } from '../../revenue-capability.entry';
import * as packageEntrypoint from '../../index';

const CONTEXT = new ClientContext('client-northwind', 'org-northwind');
const PRODUCED_AT = new Date('2026-07-25T10:00:00.000Z');
const CONSTRUCTED_AT = new Date('2026-07-15T09:30:00.000Z');

const HERE = dirname(fileURLToPath(import.meta.url));
const CAPABILITY_SRC = join(HERE, '..', '..');
const MODULE_PATH = join(CAPABILITY_SRC, 'processing', 'assess-revenue-context-readiness.ts');

/**
 * The real sparse sample context: discovery sample → Draft BIF (PR #75) → scored
 * (PR #79) → projected (PR #83). Root confidence 17, completeness 12.
 *
 * The test assembles the projection itself — exactly as ADR-0026 Decision 1
 * requires the CALLER to — and hands the capability the neutral contract only.
 */
function sampleContext(): ScoredBifContext {
  const { bif } = mapBusinessDiscoveryToBifDraft(SAMPLE_BUSINESS_DISCOVERY_PROFILE, {
    organizationId: 'org-northwind',
    constructedAt: CONSTRUCTED_AT,
    changedBy: 'analyst@example.com',
  });
  const scored = scoreBusinessIntelligenceFramework(bif);
  return projectScoredBifContext(scored.bif, { scoringMetadata: scored.metadata });
}

/** Immutable structural override, so synthetic cases keep real enum values. */
function withOverrides(
  base: ScoredBifContext,
  overrides: Partial<ScoredBifContext>,
): ScoredBifContext {
  return { ...base, ...overrides };
}

/** Every required section scored at 100 and nothing omitted — the only route to `ready`. */
function fullyScoredContext(): ScoredBifContext {
  const base = sampleContext();
  return withOverrides(base, {
    bifConfidenceScore: 100,
    bifCompletenessScore: 100,
    omittedSections: [],
    sections: base.sections.map((section) => ({
      ...section,
      confidenceScore: 100,
      completenessScore: 100,
    })),
  });
}

/**
 * Every module specifier a file actually imports.
 *
 * Deliberately parsed from `from '...'` / `require('...')` rather than searched
 * for as substrings: the source discusses `@age/bif` in prose precisely because
 * it must never import it, and a substring guard would confuse the two.
 */
function importedSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:from|require\()\s*['"]([^'"]+)['"]/g)].map(
    (match) => match[1] ?? '',
  );
}

/** Recursively collect the capability's own source files. */
function capabilitySourceFiles(directory: string = CAPABILITY_SRC): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) return capabilitySourceFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

describe('assessRevenueContextReadiness (ADR-0027, third adopter)', () => {
  describe('consumption of the neutral projection', () => {
    it('accepts a ScoredBifContext and returns the shared capability result', () => {
      const result = assessRevenueContextReadiness(CONTEXT, sampleContext(), {
        producedAt: PRODUCED_AT,
      });

      expect(result.output).toBeInstanceOf(CapabilityOutput);
      expect(result.output.capability).toBe(Capability.Revenue);
      expect(result.output.clientId).toBe('client-northwind');
      expect(result.output.organizationId).toBe('org-northwind');
      expect(result.summary.assessmentVersion).toBe(REVENUE_CONTEXT_READINESS_VERSION);
      expect(result.summary.bifId).toBe(sampleContext().bifId);
    });

    it('is reachable through the capability class and the package entrypoint', () => {
      const viaClass = new RevenueCapability().assessRevenueContext(CONTEXT, sampleContext(), {
        producedAt: PRODUCED_AT,
      });

      expect(viaClass.output.sufficiency?.state).toBe(CapabilitySufficiencyState.Partial);
      expect(packageEntrypoint.assessRevenueContextReadiness).toBe(assessRevenueContextReadiness);
      expect(packageEntrypoint.REVENUE_CONTEXT_READINESS_THRESHOLDS).toBe(
        REVENUE_CONTEXT_READINESS_THRESHOLDS,
      );
    });

    it('does not introduce a separate result type — sufficiency rides the shared envelope', () => {
      const result = assessRevenueContextReadiness(CONTEXT, sampleContext(), {
        producedAt: PRODUCED_AT,
      });

      expect(Object.keys(result).sort()).toEqual(['output', 'summary']);
      expect(result.output.sufficiency).toBeDefined();
    });
  });

  describe('the 17-confidence sample context', () => {
    it('returns partial — not ready — with exactly one required section supported', () => {
      const result = assessRevenueContextReadiness(CONTEXT, sampleContext(), {
        producedAt: PRODUCED_AT,
      });

      expect(result.output.sufficiency?.state).toBe(CapabilitySufficiencyState.Partial);
      expect(result.summary.bifConfidenceScore).toBe(17);
      expect(result.summary.bifCompletenessScore).toBe(12);
      expect(result.summary.presentSectionCount).toBe(7);
      expect(result.summary.populatedFieldCount).toBe(10);
      // products_services (63 confidence / 100 completeness) is the only required
      // section clearing both thresholds; icp_personas (45) and gtm_system (24)
      // fall short.
      expect(result.summary.supportedSections.map((section) => section.sectionType)).toEqual([
        'products_services',
      ]);
      expect(result.summary.weakSections.map((section) => section.sectionType).sort()).toEqual([
        'gtm_system',
        'icp_personas',
      ]);
    });

    it('judges the revenue required set — a DIFFERENT set from Market Discovery', () => {
      const { summary } = assessRevenueContextReadiness(CONTEXT, sampleContext(), {
        producedAt: PRODUCED_AT,
      });

      // gtm_system is required here; market_competition (Market Discovery's third
      // required section) is not judged by Revenue at all.
      expect(summary.requiredSectionTypes).toEqual(REQUIRED_REVENUE_CONTEXT_SECTION_TYPES);
      expect(summary.requiredSectionTypes).toContain('gtm_system');
      expect(summary.requiredSectionTypes).not.toContain('market_competition');

      const judged = [
        ...summary.supportedSections,
        ...summary.weakSections,
        ...summary.absentSections,
      ].map((section) => section.sectionType);
      expect(judged).toHaveLength(REQUIRED_REVENUE_CONTEXT_SECTION_TYPES.length);
      for (const sectionType of judged) {
        expect(REQUIRED_REVENUE_CONTEXT_SECTION_TYPES).toContain(sectionType);
      }
    });

    it('explains every weak section as a context limit, not a revenue finding', () => {
      const { summary } = assessRevenueContextReadiness(CONTEXT, sampleContext(), {
        producedAt: PRODUCED_AT,
      });

      expect(summary.weakSections).toHaveLength(2);
      for (const section of summary.weakSections) {
        expect(section.reason).toContain('cannot be relied on yet');
        expect(section.reason).toContain('not a finding about the business or its revenue');
        expect(section.reason).toMatch(/below the required \d+/);
      }
      const gtm = summary.weakSections.find((s) => s.sectionType === 'gtm_system');
      expect(gtm?.sectionConfidenceScore).toBe(24);
      expect(gtm?.reason).toContain('confidence 24 is below the required 50');
    });

    it('reports absent required sections as unknown, never as weakness', () => {
      const base = sampleContext();
      const withoutGtm = withOverrides(base, {
        sections: base.sections.filter((section) => String(section.type) !== 'gtm_system'),
        omittedSections: [
          ...base.omittedSections,
          { type: 'gtm_system', name: 'GTM System' } as (typeof base.omittedSections)[number],
        ],
      });

      const { summary } = assessRevenueContextReadiness(CONTEXT, withoutGtm, {
        producedAt: PRODUCED_AT,
      });

      expect(summary.absentSections.map((section) => section.sectionType)).toEqual(['gtm_system']);
      for (const section of summary.absentSections) {
        expect(section.limitation).toContain('is unknown');
        expect(section.limitation).toContain('must not be read as a strength or a weakness');
      }
      expect(summary.supportedSections.map((s) => s.sectionType)).not.toContain('gtm_system');
    });

    it('carries the scoring layer warnings and reasons through without suppressing them', () => {
      const context = sampleContext();
      const { output, summary } = assessRevenueContextReadiness(CONTEXT, context, {
        producedAt: PRODUCED_AT,
      });

      expect(summary.carriedWarnings).toEqual(context.warnings);
      expect(summary.carriedReasons).toEqual(context.reasons);
      expect(output.sufficiency?.warnings).toEqual(context.warnings);
    });

    it('states what would raise readiness without recommending strategy', () => {
      const { summary } = assessRevenueContextReadiness(CONTEXT, sampleContext(), {
        producedAt: PRODUCED_AT,
      });

      expect(summary.improvementHints).toHaveLength(1);
      expect(summary.improvementHints[0]).toContain('would move those section(s) into supported');
    });
  });

  describe('no revenue plan is derived, ranked, named or hinted at (ADR-0027 Decision 1)', () => {
    const contexts = (): ScoredBifContext[] => [
      sampleContext(),
      fullyScoredContext(),
      withOverrides(sampleContext(), { contextVersion: '9.9.9' }),
    ];

    it('emits no items in any state — structurally, not incidentally', () => {
      for (const context of contexts()) {
        const result = assessRevenueContextReadiness(CONTEXT, context, {
          producedAt: PRODUCED_AT,
        });
        expect(result.output.items).toEqual([]);
      }
    });

    it('never names a plan, opportunity, action or recommendation in any emitted text', () => {
      const forbidden =
        /\b(opportunit(y|ies)|recommend(ed|ation|ations)?|plan|action|strateg(y|ic|ies)|upsell|cross-sell|renewal|expansion|next step|should|priorit)/i;

      for (const context of contexts()) {
        const result = assessRevenueContextReadiness(CONTEXT, context, {
          producedAt: PRODUCED_AT,
        });
        const text = [
          ...(result.output.sufficiency?.reasons ?? []),
          ...(result.output.sufficiency?.warnings ?? []),
          ...result.summary.limitations,
          ...result.summary.improvementHints,
          ...result.summary.weakSections.map((s) => s.reason),
          ...result.summary.absentSections.map((s) => s.limitation),
        ];

        for (const line of text) {
          // The single sanctioned mention is the explicit non-derivation notice.
          if (line.includes('It derives no revenue plan')) continue;
          expect(line).not.toMatch(forbidden);
        }
      }
    });

    it('states in its reasons that no revenue plan may be inferred from it', () => {
      const result = assessRevenueContextReadiness(CONTEXT, sampleContext(), {
        producedAt: PRODUCED_AT,
      });

      expect(result.output.sufficiency?.reasons.join(' ')).toContain(
        'It derives no revenue plan, and no revenue plan may be inferred from it',
      );
    });

    it('produces no plan-shaped summary — it is not a RevenueProcessingSummary', () => {
      const { summary } = assessRevenueContextReadiness(CONTEXT, sampleContext(), {
        producedAt: PRODUCED_AT,
      });

      for (const key of [
        'derivedCount',
        'acceptedCount',
        'rejectedCount',
        'duplicateCount',
        'rejectedReasons',
        'duplicates',
        'scoredPlans',
      ]) {
        expect(summary).not.toHaveProperty(key);
      }
    });
  });

  describe('readiness is not a gate (ADR-0027 Decision 1)', () => {
    it('is a separate entry point — run neither calls it nor is blocked by it', () => {
      const source = readFileSync(join(CAPABILITY_SRC, 'revenue-capability.ts'), 'utf8');
      const runStart = source.indexOf('async run(');
      const runBody = source.slice(runStart, source.indexOf('\n  }', runStart));

      expect(runBody).toContain('processRevenue(context, input)');
      expect(runBody).not.toContain('assessRevenueContextReadiness');
      expect(runBody).not.toContain('sufficiency');
      expect(runBody).not.toContain('ScoredBifContext');
      expect(typeof new RevenueCapability().run).toBe('function');
      expect(typeof new RevenueCapability().assessRevenueContext).toBe('function');
    });

    it('leaves the existing pipeline untouched — it never reads a ScoredBifContext', () => {
      const pipeline = readFileSync(
        join(CAPABILITY_SRC, 'processing', 'process-revenue.ts'),
        'utf8',
      );

      expect(importedSpecifiers(pipeline)).not.toContain('@age/business-discovery-contracts');
      expect(pipeline).not.toContain('assessRevenueContextReadiness');
    });
  });

  describe('sufficiency states', () => {
    it('reports ready only when every required section is supported and root confidence is high', () => {
      const result = assessRevenueContextReadiness(CONTEXT, fullyScoredContext(), {
        producedAt: PRODUCED_AT,
      });

      expect(result.output.sufficiency?.state).toBe(CapabilitySufficiencyState.Ready);
      expect(result.summary.weakSections).toHaveLength(0);
      expect(result.summary.absentSections).toHaveLength(0);
      expect(result.summary.limitations).toHaveLength(0);
    });

    it('withholds ready when sections are strong but a required section is absent', () => {
      const strong = fullyScoredContext();
      const strongButIncomplete = withOverrides(strong, {
        sections: strong.sections.filter((section) => String(section.type) !== 'gtm_system'),
        omittedSections: [
          { type: 'gtm_system', name: 'GTM System' } as (typeof strong.omittedSections)[number],
        ],
      });

      const result = assessRevenueContextReadiness(CONTEXT, strongButIncomplete, {
        producedAt: PRODUCED_AT,
      });

      expect(result.output.sufficiency?.state).toBe(CapabilitySufficiencyState.Partial);
    });

    it('withholds ready when sections are strong but root confidence is low', () => {
      const lowRoot = withOverrides(fullyScoredContext(), { bifConfidenceScore: 69 });

      const result = assessRevenueContextReadiness(CONTEXT, lowRoot, { producedAt: PRODUCED_AT });

      expect(result.output.sufficiency?.state).toBe(CapabilitySufficiencyState.Partial);
    });

    it('returns insufficient as a SUCCESSFUL outcome when no required section clears the thresholds', () => {
      const base = sampleContext();
      const allWeak = withOverrides(base, {
        sections: base.sections.map((section) => ({
          ...section,
          confidenceScore: 20,
          completenessScore: 20,
        })),
      });

      const result = assessRevenueContextReadiness(CONTEXT, allWeak, { producedAt: PRODUCED_AT });

      expect(result.output.sufficiency?.state).toBe(CapabilitySufficiencyState.Insufficient);
      expect(result.output.items).toEqual([]);
      expect(result.summary.supportedSections).toHaveLength(0);
      expect(result.output.sufficiency?.reasons[0]).toContain('no reliable revenue context');
    });

    it('returns blocked — distinct from insufficient — when the context carries nothing', () => {
      const base = sampleContext();
      const empty = withOverrides(base, {
        sections: [],
        metadata: { ...base.metadata, presentSectionCount: 0, populatedFieldCount: 0 },
      });

      const result = assessRevenueContextReadiness(CONTEXT, empty, { producedAt: PRODUCED_AT });

      expect(result.output.sufficiency?.state).toBe(CapabilitySufficiencyState.Blocked);
      expect(result.output.sufficiency?.state).not.toBe(CapabilitySufficiencyState.Insufficient);
      expect(result.output.items).toEqual([]);
      expect(result.output.sufficiency?.reasons[0]).toContain('no revenue context to assess');
      expect(result.output.sufficiency?.reasons[0]).toContain('Nothing is inferred');
    });

    it('returns blocked when the context version is not understood', () => {
      const future = withOverrides(sampleContext(), { contextVersion: '2.0.0' });

      const result = assessRevenueContextReadiness(CONTEXT, future, { producedAt: PRODUCED_AT });

      expect(result.output.sufficiency?.state).toBe(CapabilitySufficiencyState.Blocked);
      expect(result.output.sufficiency?.reasons[0]).toContain("version '2.0.0' is not supported");
    });

    it('carries mandatory, non-empty reasons in every state', () => {
      const base = sampleContext();
      const cases: ScoredBifContext[] = [
        fullyScoredContext(),
        base,
        withOverrides(base, {
          sections: base.sections.map((section) => ({
            ...section,
            confidenceScore: 1,
            completenessScore: 1,
          })),
        }),
        withOverrides(base, { contextVersion: '9.9.9' }),
      ];

      const states = cases.map((context) => {
        const result = assessRevenueContextReadiness(CONTEXT, context, { producedAt: PRODUCED_AT });
        const reasons = result.output.sufficiency?.reasons ?? [];
        expect(reasons.length).toBeGreaterThan(0);
        for (const reason of reasons) expect(reason.trim().length).toBeGreaterThan(0);
        return result.output.sufficiency?.state;
      });

      expect(states).toEqual([
        CapabilitySufficiencyState.Ready,
        CapabilitySufficiencyState.Partial,
        CapabilitySufficiencyState.Insufficient,
        CapabilitySufficiencyState.Blocked,
      ]);
    });
  });

  describe('caller-supplied producedAt (ADR-0026 Decision 2)', () => {
    it('uses the supplied timestamp exactly', () => {
      const result = assessRevenueContextReadiness(CONTEXT, sampleContext(), {
        producedAt: PRODUCED_AT,
      });

      expect(result.output.producedAt).toBe(PRODUCED_AT);
    });

    it('refuses to run without one rather than reading the wall clock', () => {
      expect(() =>
        // @ts-expect-error producedAt is required by the deterministic contract.
        assessRevenueContextReadiness(CONTEXT, sampleContext(), {}),
      ).toThrow(/caller-supplied producedAt/);
    });
  });

  describe('determinism and purity', () => {
    it('produces a deeply identical result for identical inputs', () => {
      const context = sampleContext();

      const first = assessRevenueContextReadiness(CONTEXT, context, { producedAt: PRODUCED_AT });
      const second = assessRevenueContextReadiness(CONTEXT, context, { producedAt: PRODUCED_AT });

      expect(second).toEqual(first);
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    });

    it('does not mutate the ScoredBifContext it was given', () => {
      const context = sampleContext();
      const before = JSON.stringify(context);

      assessRevenueContextReadiness(CONTEXT, context, { producedAt: PRODUCED_AT });

      expect(JSON.stringify(context)).toBe(before);
    });

    it('emits arrays that are not the projection’s own arrays', () => {
      const context = sampleContext();
      const { summary } = assessRevenueContextReadiness(CONTEXT, context, {
        producedAt: PRODUCED_AT,
      });

      expect(summary.carriedWarnings).not.toBe(context.warnings);
      expect(summary.carriedReasons).not.toBe(context.reasons);
    });

    it('reads no clock, randomness, environment, filesystem or network (purity guard)', () => {
      const source = readFileSync(MODULE_PATH, 'utf8');

      for (const forbidden of [
        'new Date(',
        'Date.now(',
        'Math.random(',
        'performance.now(',
        'fetch(',
        'node:fs',
        'node:https',
        'process.env',
        'crypto',
      ]) {
        expect(source).not.toContain(forbidden);
      }
    });

    it('never recomputes a score, promotes BIF status, or creates a placeholder section', () => {
      const context = sampleContext();
      const { summary } = assessRevenueContextReadiness(CONTEXT, context, {
        producedAt: PRODUCED_AT,
      });

      expect(summary.bifConfidenceScore).toBe(context.bifConfidenceScore);
      expect(summary.bifCompletenessScore).toBe(context.bifCompletenessScore);
      for (const section of [...summary.supportedSections, ...summary.weakSections]) {
        const source = context.sections.find((s) => String(s.type) === section.sectionType);
        expect(section.sectionConfidenceScore).toBe(source?.confidenceScore);
        expect(section.sectionCompletenessScore).toBe(source?.completenessScore);
      }
      expect(summary.bifStatus).toBe(String(context.bifStatus));
      expect(summary.bifStatus).toBe('Draft');
      const presentTypes = new Set(context.sections.map((s) => String(s.type)));
      for (const section of [...summary.supportedSections, ...summary.weakSections]) {
        expect(presentTypes.has(section.sectionType)).toBe(true);
      }
    });

    it('publishes the thresholds it applied and imports no other capability’s policy', () => {
      const { summary } = assessRevenueContextReadiness(CONTEXT, sampleContext(), {
        producedAt: PRODUCED_AT,
      });

      expect(summary.thresholds).toEqual({
        minSectionConfidenceScore: 50,
        minSectionCompletenessScore: 50,
        minRootConfidenceScoreForReady: 70,
      });

      const imported = importedSpecifiers(readFileSync(MODULE_PATH, 'utf8'));
      for (const forbidden of [
        '@age/capability-intelligence',
        '@age/capability-market-discovery',
        '@age/capability-authority',
        '@age/capability-growth',
        '@age/capability-operations',
      ]) {
        expect(imported).not.toContain(forbidden);
      }
    });
  });

  describe('capability boundaries', () => {
    it('declares no dependency on @age/bif', () => {
      const manifest = JSON.parse(
        readFileSync(join(CAPABILITY_SRC, '..', 'package.json'), 'utf8'),
      ) as { dependencies?: Record<string, string> };

      const dependencies = Object.keys(manifest.dependencies ?? {});
      expect(dependencies).not.toContain('@age/bif');
      expect(dependencies).toContain('@age/business-discovery-contracts');
    });

    it('imports @age/bif nowhere in the capability source', () => {
      for (const file of capabilitySourceFiles()) {
        expect(importedSpecifiers(readFileSync(file, 'utf8'))).not.toContain('@age/bif');
      }
    });

    it('touches no engine, API, Web, persistence, demo-runtime or AI surface', () => {
      const imported = importedSpecifiers(readFileSync(MODULE_PATH, 'utf8'));

      for (const forbidden of [
        '@age/bif',
        '@age/business-knowledge-graph',
        '@age/research-intelligence-engine',
        '@age/strategic-intelligence-engine',
        '@age/demo-runtime',
        '@age/api',
        '@age/web',
        'prisma',
        'pg',
        'anthropic',
        'openai',
        'axios',
      ]) {
        expect(imported).not.toContain(forbidden);
      }

      expect(imported.filter((specifier) => specifier.startsWith('@age/')).sort()).toEqual([
        '@age/business-discovery-contracts',
        '@age/capability-kit',
        '@age/capability-kit',
      ]);
    });

    it('advertises ScoredBifContext only via assessesContext, never consumes (ADR-0028)', () => {
      const entry = readFileSync(join(CAPABILITY_SRC, 'revenue-capability.entry.ts'), 'utf8');

      // `consumes` — the inputs `run` requires — is unchanged.
      expect(entry).toContain("consumes: ['RevenueInput']");
      // ScoredBifContext is the assessed (optional, non-gating) context, so it
      // rides assessesContext and must never leak into the required-input list.
      expect(entry).toContain("assessesContext: ['ScoredBifContext']");
      expect(REVENUE_CAPABILITY_ENTRY.consumes).not.toContain('ScoredBifContext');
      expect(REVENUE_CAPABILITY_ENTRY.assessesContext).toEqual(['ScoredBifContext']);
    });
  });
});
