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
  produceScoredBifContext,
  type ScoredBifContext,
} from '@age/business-discovery-contracts';
import {
  BUSINESS_CONTEXT_ASSESSMENT_VERSION,
  BUSINESS_CONTEXT_SUPPORT_THRESHOLDS,
  assessScoredBifContext,
} from '../../processing/assess-scored-bif-context';
import { IntelligenceCapability } from '../../intelligence-capability';
import * as packageEntrypoint from '../../index';

const CONTEXT = new ClientContext('client-northwind', 'org-northwind');
const PRODUCED_AT = new Date('2026-07-24T10:00:00.000Z');
const CONSTRUCTED_AT = new Date('2026-07-15T09:30:00.000Z');

const HERE = dirname(fileURLToPath(import.meta.url));
const CAPABILITY_SRC = join(HERE, '..', '..');
const MODULE_PATH = join(CAPABILITY_SRC, 'processing', 'assess-scored-bif-context.ts');

/**
 * The real sparse sample context: discovery sample → Draft BIF (PR #75) → scored
 * (PR #79) → projected (PR #83). Root confidence 17, completeness 12.
 *
 * Note the test assembles the projection itself — exactly as ADR-0026 Decision 1
 * requires the CALLER to — and hands the capability the neutral contract only.
 */
function sampleContext(): ScoredBifContext {
  return produceScoredBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE, {
    organizationId: 'org-northwind',
    constructedAt: CONSTRUCTED_AT,
    changedBy: 'analyst@example.com',
  }).context;
}

/** Immutable structural override, so synthetic cases keep real enum values. */
function withOverrides(
  base: ScoredBifContext,
  overrides: Partial<ScoredBifContext>,
): ScoredBifContext {
  return { ...base, ...overrides };
}

/** Every section scored at 100 and nothing omitted — the only route to `ready`. */
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

describe('assessScoredBifContext (ADR-0026 Decision 5)', () => {
  describe('consumption of the neutral projection', () => {
    it('accepts a ScoredBifContext and returns the shared capability result', () => {
      const result = assessScoredBifContext(CONTEXT, sampleContext(), {
        producedAt: PRODUCED_AT,
      });

      expect(result.output).toBeInstanceOf(CapabilityOutput);
      expect(result.output.capability).toBe(Capability.Intelligence);
      expect(result.output.clientId).toBe('client-northwind');
      expect(result.output.organizationId).toBe('org-northwind');
      expect(result.summary.assessmentVersion).toBe(BUSINESS_CONTEXT_ASSESSMENT_VERSION);
      expect(result.summary.bifId).toBe(sampleContext().bifId);
    });

    it('is reachable through the capability class and the package entrypoint', () => {
      const viaClass = new IntelligenceCapability().assessBusinessContext(
        CONTEXT,
        sampleContext(),
        { producedAt: PRODUCED_AT },
      );

      expect(viaClass.output.sufficiency?.state).toBe(CapabilitySufficiencyState.Partial);
      expect(packageEntrypoint.assessScoredBifContext).toBe(assessScoredBifContext);
      expect(packageEntrypoint.BUSINESS_CONTEXT_SUPPORT_THRESHOLDS).toBe(
        BUSINESS_CONTEXT_SUPPORT_THRESHOLDS,
      );
    });

    it('does not introduce a separate result type — sufficiency rides the shared envelope', () => {
      const result = assessScoredBifContext(CONTEXT, sampleContext(), {
        producedAt: PRODUCED_AT,
      });

      // The sufficiency state lives on the shared CapabilityOutput envelope, and
      // the result is the shared CapabilityResult pairing (output + summary).
      expect(Object.keys(result).sort()).toEqual(['output', 'summary']);
      expect(result.output.sufficiency).toBeDefined();
    });
  });

  describe('the 17-confidence sample context', () => {
    it('returns partial — not ready — and never claims more than one supported section', () => {
      const result = assessScoredBifContext(CONTEXT, sampleContext(), {
        producedAt: PRODUCED_AT,
      });

      expect(result.output.sufficiency?.state).toBe(CapabilitySufficiencyState.Partial);
      expect(result.summary.bifConfidenceScore).toBe(17);
      expect(result.summary.bifCompletenessScore).toBe(12);
      expect(result.summary.presentSectionCount).toBe(7);
      expect(result.summary.supportedSectionCount).toBe(1);
      expect(result.summary.populatedFieldCount).toBe(10);
      // products_services (63 confidence / 100 completeness) is the only section
      // clearing both thresholds; every other present section falls short.
      expect(result.output.items.map((item) => item.sectionType)).toEqual(['products_services']);
    });

    it('explains every present-but-weak section as a context limit, not a business finding', () => {
      const { summary } = assessScoredBifContext(CONTEXT, sampleContext(), {
        producedAt: PRODUCED_AT,
      });

      expect(summary.unsupportedSections).toHaveLength(6);
      for (const section of summary.unsupportedSections) {
        expect(section.reason).toContain('cannot be relied on yet');
        expect(section.reason).toContain('not a finding about the business');
        // The shortfall quotes the real score against the real threshold.
        expect(section.reason).toMatch(/below the required \d+/);
      }
      const icp = summary.unsupportedSections.find((s) => s.sectionType === 'icp_personas');
      expect(icp?.sectionConfidenceScore).toBe(45);
      expect(icp?.reason).toContain('confidence 45 is below the required 50');
    });

    it('reports the five absent sections as unknown, never as weakness', () => {
      const { summary } = assessScoredBifContext(CONTEXT, sampleContext(), {
        producedAt: PRODUCED_AT,
      });

      expect(summary.missingSections).toHaveLength(5);
      for (const section of summary.missingSections) {
        expect(section.limitation).toContain('is unknown');
        expect(section.limitation).toContain('must not be read as a strength or a weakness');
      }
      // Absent sections never become items and never become supported sections.
      const itemTypes = new Set(
        assessScoredBifContext(CONTEXT, sampleContext(), {
          producedAt: PRODUCED_AT,
        }).output.items.map((item) => item.sectionType),
      );
      for (const section of summary.missingSections) {
        expect(itemTypes.has(section.sectionType)).toBe(false);
      }
    });

    it('carries the scoring layer warnings and reasons through without suppressing them', () => {
      const context = sampleContext();
      const { output, summary } = assessScoredBifContext(CONTEXT, context, {
        producedAt: PRODUCED_AT,
      });

      expect(summary.carriedWarnings).toEqual(context.warnings);
      expect(summary.carriedReasons).toEqual(context.reasons);
      expect(output.sufficiency?.warnings).toEqual(context.warnings);
    });

    it('states what would raise sufficiency without recommending strategy', () => {
      const { summary } = assessScoredBifContext(CONTEXT, sampleContext(), {
        producedAt: PRODUCED_AT,
      });

      expect(summary.improvementHints).toHaveLength(2);
      expect(summary.improvementHints[0]).toContain('would move those section(s) into supported');
      expect(summary.improvementHints[1]).toContain('would remove the unknowns');
    });
  });

  describe('sufficiency states', () => {
    it('reports ready only when every section is present, scored and root-confident', () => {
      const result = assessScoredBifContext(CONTEXT, fullyScoredContext(), {
        producedAt: PRODUCED_AT,
      });

      expect(result.output.sufficiency?.state).toBe(CapabilitySufficiencyState.Ready);
      expect(result.summary.unsupportedSections).toHaveLength(0);
      expect(result.summary.missingSections).toHaveLength(0);
      expect(result.summary.limitations).toHaveLength(0);
    });

    it('withholds ready when sections are strong but a canonical section is absent', () => {
      const strongButIncomplete = withOverrides(fullyScoredContext(), {
        omittedSections: sampleContext().omittedSections,
      });

      const result = assessScoredBifContext(CONTEXT, strongButIncomplete, {
        producedAt: PRODUCED_AT,
      });

      expect(result.output.sufficiency?.state).toBe(CapabilitySufficiencyState.Partial);
    });

    it('withholds ready when sections are strong but root confidence is low', () => {
      const lowRoot = withOverrides(fullyScoredContext(), { bifConfidenceScore: 69 });

      const result = assessScoredBifContext(CONTEXT, lowRoot, { producedAt: PRODUCED_AT });

      expect(result.output.sufficiency?.state).toBe(CapabilitySufficiencyState.Partial);
    });

    it('returns insufficient as a SUCCESSFUL outcome when no section clears the thresholds', () => {
      const base = sampleContext();
      const allWeak = withOverrides(base, {
        sections: base.sections.map((section) => ({
          ...section,
          confidenceScore: 20,
          completenessScore: 20,
        })),
      });

      // Not thrown, not an error — a normal return carrying an honest state.
      const result = assessScoredBifContext(CONTEXT, allWeak, { producedAt: PRODUCED_AT });

      expect(result.output.sufficiency?.state).toBe(CapabilitySufficiencyState.Insufficient);
      expect(result.output.items).toHaveLength(0);
      expect(result.summary.supportedSectionCount).toBe(0);
      expect(result.summary.unsupportedSections).toHaveLength(7);
      expect(result.output.sufficiency?.reasons[0]).toContain('no reliable business context');
    });

    it('returns blocked — distinct from insufficient — when the context carries nothing', () => {
      const base = sampleContext();
      const empty = withOverrides(base, {
        sections: [],
        metadata: { ...base.metadata, presentSectionCount: 0, populatedFieldCount: 0 },
      });

      const result = assessScoredBifContext(CONTEXT, empty, { producedAt: PRODUCED_AT });

      expect(result.output.sufficiency?.state).toBe(CapabilitySufficiencyState.Blocked);
      expect(result.output.sufficiency?.state).not.toBe(CapabilitySufficiencyState.Insufficient);
      expect(result.output.items).toHaveLength(0);
      expect(result.output.sufficiency?.reasons[0]).toContain('no business context to assess');
      expect(result.output.sufficiency?.reasons[0]).toContain('Nothing is inferred');
    });

    it('returns blocked when the context version is not understood', () => {
      const future = withOverrides(sampleContext(), { contextVersion: '2.0.0' });

      const result = assessScoredBifContext(CONTEXT, future, { producedAt: PRODUCED_AT });

      expect(result.output.sufficiency?.state).toBe(CapabilitySufficiencyState.Blocked);
      expect(result.output.sufficiency?.reasons[0]).toContain("version '2.0.0' is not supported");
    });

    it('carries mandatory, non-empty reasons in every state', () => {
      const cases: ScoredBifContext[] = [
        fullyScoredContext(),
        sampleContext(),
        withOverrides(sampleContext(), {
          sections: sampleContext().sections.map((section) => ({
            ...section,
            confidenceScore: 1,
            completenessScore: 1,
          })),
        }),
        withOverrides(sampleContext(), { contextVersion: '9.9.9' }),
      ];

      const states = cases.map((context) => {
        const result = assessScoredBifContext(CONTEXT, context, { producedAt: PRODUCED_AT });
        const reasons = result.output.sufficiency?.reasons ?? [];
        expect(reasons.length).toBeGreaterThan(0);
        for (const reason of reasons) expect(reason.trim().length).toBeGreaterThan(0);
        return result.output.sufficiency?.state;
      });

      // All four states are reachable and distinct.
      expect(states).toEqual([
        CapabilitySufficiencyState.Ready,
        CapabilitySufficiencyState.Partial,
        CapabilitySufficiencyState.Insufficient,
        CapabilitySufficiencyState.Blocked,
      ]);
    });
  });

  describe('caller-supplied producedAt (ADR-0026 Decision 2)', () => {
    it('uses the supplied timestamp exactly, on the envelope and on every item', () => {
      const result = assessScoredBifContext(CONTEXT, sampleContext(), {
        producedAt: PRODUCED_AT,
      });

      expect(result.output.producedAt).toBe(PRODUCED_AT);
      expect(result.output.items.length).toBeGreaterThan(0);
      for (const item of result.output.items) {
        expect(item.createdAt).toBe(PRODUCED_AT);
      }
    });

    it('refuses to run without one rather than reading the wall clock', () => {
      expect(() =>
        // @ts-expect-error producedAt is required by the deterministic contract.
        assessScoredBifContext(CONTEXT, sampleContext(), {}),
      ).toThrow(/caller-supplied producedAt/);
    });
  });

  describe('determinism and purity', () => {
    it('produces a deeply identical result for identical inputs', () => {
      const context = sampleContext();

      const first = assessScoredBifContext(CONTEXT, context, { producedAt: PRODUCED_AT });
      const second = assessScoredBifContext(CONTEXT, context, { producedAt: PRODUCED_AT });

      expect(second).toEqual(first);
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
      // Item ids are derived, not generated.
      expect(second.output.items.map((i) => i.id)).toEqual(first.output.items.map((i) => i.id));
    });

    it('does not mutate the ScoredBifContext it was given', () => {
      const context = sampleContext();
      const before = JSON.stringify(context);

      assessScoredBifContext(CONTEXT, context, { producedAt: PRODUCED_AT });

      expect(JSON.stringify(context)).toBe(before);
    });

    it('emits arrays that are not the projection’s own arrays', () => {
      const context = sampleContext();
      const { summary } = assessScoredBifContext(CONTEXT, context, {
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
      const { output, summary } = assessScoredBifContext(CONTEXT, context, {
        producedAt: PRODUCED_AT,
      });

      // Scores are copied, never derived.
      expect(summary.bifConfidenceScore).toBe(context.bifConfidenceScore);
      expect(summary.bifCompletenessScore).toBe(context.bifCompletenessScore);
      for (const item of output.items) {
        const source = context.sections.find((s) => String(s.type) === item.sectionType);
        expect(item.sectionConfidenceScore).toBe(source?.confidenceScore);
        expect(item.sectionCompletenessScore).toBe(source?.completenessScore);
      }
      // Status carried through, never promoted.
      expect(summary.bifStatus).toBe(String(context.bifStatus));
      expect(summary.bifStatus).toBe('Draft');
      // Items exist only for sections the projection actually carried.
      const presentTypes = new Set(context.sections.map((s) => String(s.type)));
      for (const item of output.items) {
        expect(presentTypes.has(item.sectionType)).toBe(true);
        expect(item.supportedFields.length).toBeGreaterThan(0);
      }
    });

    it('publishes the thresholds it applied and introduces no other threshold policy', () => {
      const { summary } = assessScoredBifContext(CONTEXT, sampleContext(), {
        producedAt: PRODUCED_AT,
      });

      expect(summary.thresholds).toEqual({
        minSectionConfidenceScore: 50,
        minSectionCompletenessScore: 50,
        minRootConfidenceScoreForReady: 70,
      });

      // The thresholds are this capability's own, declared in one place, and are
      // not read from or shared with any other capability or shared package.
      const source = readFileSync(MODULE_PATH, 'utf8');
      expect(source).toContain('BUSINESS_CONTEXT_SUPPORT_THRESHOLDS');
      expect(source).not.toContain('@age/capability-authority');
      expect(source).not.toContain('@age/capability-growth');
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

      // The only things it imports are the shared kit and the neutral projection.
      expect(imported.filter((specifier) => specifier.startsWith('@age/')).sort()).toEqual([
        '@age/business-discovery-contracts',
        '@age/capability-kit',
        '@age/capability-kit',
      ]);
    });
  });
});
