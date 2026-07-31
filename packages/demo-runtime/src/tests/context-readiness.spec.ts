import { describe, expect, it } from 'vitest';

import { INTELLIGENCE_CAPABILITY_ENTRY } from '@age/capability-intelligence';
import { BUSINESS_CONTEXT_SUPPORT_THRESHOLDS } from '@age/capability-intelligence';
import {
  MARKET_DISCOVERY_CAPABILITY_ENTRY,
  MARKET_CONTEXT_READINESS_THRESHOLDS,
  REQUIRED_MARKET_CONTEXT_SECTION_TYPES,
} from '@age/capability-market-discovery';
import {
  REVENUE_CAPABILITY_ENTRY,
  REVENUE_CONTEXT_READINESS_THRESHOLDS,
  REQUIRED_REVENUE_CONTEXT_SECTION_TYPES,
} from '@age/capability-revenue';
import { GROWTH_CAPABILITY_ENTRY } from '@age/capability-growth';
import { AUTHORITY_CAPABILITY_ENTRY } from '@age/capability-authority';
import { OPERATIONS_CAPABILITY_ENTRY } from '@age/capability-operations';

import { buildContextReadinessReport, type ContextReadinessReport } from '../context-readiness';
import { produceDemoScoredBifContext } from '../scored-bif-context';
import { runAllCapabilities } from '../capabilities';
import { DEMO_SCENARIO_METADATA } from '../demo-scenario-metadata';

/**
 * ADR-0047 D7 — the five invariant tests for the context-readiness bridge.
 *
 * These were written and failing before any wiring existed. Each one exists
 * because a specific, named mistake would otherwise be invisible:
 *
 *   (a) the demo layer authors prose that the assessors' own regex scans never
 *       see, so nothing today constrains it;
 *   (b) a readiness gate on `run` would live HERE, in demo-runtime, where a
 *       source-scan of the capability packages could not find it;
 *   (c) ordering by state is the ranking ADR-0047 D4 exists to forbid;
 *   (d) any aggregate invents the shared scale ADR-0027 D2 declined to create;
 *   (e) this slice is precisely the pressure that would add `ScoredBifContext`
 *       to `CapabilityRegistryEntry.consumes` (D6).
 *
 * ⚠️ None of them counts `output.items`. Per ADR-0047 §5 a length check is
 * WRONG for Intelligence (which legitimately emits items) and VACUOUS for
 * Market Discovery and Revenue (structurally always `[]`). They scan content.
 */

const PRODUCED_AT = new Date(DEMO_SCENARIO_METADATA.constructedAt.getTime());

function sampleContext() {
  return produceDemoScoredBifContext(DEMO_SCENARIO_METADATA).context;
}

/** A context this build cannot read, which forces every assessor to `blocked`. */
function blockedContext() {
  return { ...sampleContext(), contextVersion: '2.0.0' };
}

/** Every string leaf in an arbitrary value, collected recursively. */
function collectStrings(value: unknown, into: string[] = []): string[] {
  if (typeof value === 'string') {
    into.push(value);
  } else if (Array.isArray(value)) {
    for (const entry of value) collectStrings(entry, into);
  } else if (value !== null && typeof value === 'object') {
    for (const entry of Object.values(value)) collectStrings(entry, into);
  }
  return into;
}

/** Every object key in an arbitrary value, collected recursively. */
function collectKeys(value: unknown, into: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const entry of value) collectKeys(entry, into);
  } else if (value !== null && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      into.push(key);
      collectKeys(entry, into);
    }
  }
  return into;
}

describe('ADR-0047 D7 — context-readiness bridge invariants', () => {
  describe('D7a — forbidden vocabulary across every demo-authored string', () => {
    /**
     * The union of the two existing assessor patterns (Market Discovery and
     * Revenue). Intelligence has no scan of its own (ADR-0047 §5 erratum 2), so
     * applying the union here covers the least-defended path for the first time.
     */
    const forbidden =
      /\b(opportunit(y|ies)|recommend(ed|ation|ations)?|plan|action|strateg(y|ic|ies)|upsell|cross-sell|renewal|expansion|next step|should|priorit)/i;

    /**
     * The assessors' own sanctioned non-derivation notices. Exempted as WHOLE
     * lines, by full-substring match, never by loosening the pattern.
     */
    const sanctioned = ['It derives no market opportunity', 'It derives no revenue plan'];

    /**
     * A CANONICAL BIF SECTION NAME, not derived strategy: the BIF taxonomy names
     * one of its twelve sections 'Vision & Strategy'
     * (`packages/bif/src/sections/vision-strategy.ts`). A limitation reporting
     * that section's context cannot be relied on is exactly the honest output
     * this pattern exists to protect, and the name appears inline in lists.
     *
     * It is the ONLY one of the twelve canonical names that collides with the
     * pattern — verified against the full list — so this cannot quietly widen.
     *
     * ⚠️ Neutralized as a TOKEN rather than exempting the whole line, so the
     * REST of every such line is still scanned. This is deliberately stricter
     * than a line-level exemption.
     */
    const canonicalSectionName = "'Vision & Strategy'";
    const neutralize = (line: string) => line.split(canonicalSectionName).join("'<section>'");

    it('emits no forbidden vocabulary in any string leaf of the report', () => {
      const report = buildContextReadinessReport(sampleContext(), { producedAt: PRODUCED_AT });
      const strings = collectStrings(report);

      // ⚠️ Assert the walk found something FIRST. An empty walk would otherwise
      // report perfect compliance.
      expect(strings.length).toBeGreaterThan(0);

      for (const line of strings) {
        if (sanctioned.some((notice) => line.includes(notice))) continue;
        expect(neutralize(line)).not.toMatch(forbidden);
      }
    });

    it('states the incommensurability on the surface rather than leaving it implicit', () => {
      const report = buildContextReadinessReport(sampleContext(), { producedAt: PRODUCED_AT });
      expect(collectStrings(report.incommensurabilityNotice).length).toBeGreaterThan(0);
      expect(report.incommensurabilityNotice.join(' ')).toMatch(/not compar|different set/i);
    });
  });

  describe('D7b — run-independence, proven by injection rather than inspection', () => {
    it('produces byte-identical capability run reports under a blocked context', async () => {
      // Readiness moves from `partial`/`insufficient` to `blocked`...
      const withSample = buildContextReadinessReport(sampleContext(), { producedAt: PRODUCED_AT });
      const withBlocked = buildContextReadinessReport(blockedContext(), {
        producedAt: PRODUCED_AT,
      });
      expect(JSON.stringify(withSample)).not.toEqual(JSON.stringify(withBlocked));

      // ...and the six capability runs do not move at all. `run` is never gated
      // on context. A source-scan for "does run import assess" would NOT catch a
      // gate introduced here in demo-runtime.
      const first = await runAllCapabilities();
      const second = await runAllCapabilities();

      const strip = (reports: readonly unknown[]) => JSON.stringify(reports);
      expect(strip(first)).toEqual(strip(second));
    });
  });

  describe('D7c — ordering invariance (the mechanical test for D4)', () => {
    it('keeps emitted order and every label unchanged when the states change', () => {
      const sample = buildContextReadinessReport(sampleContext(), { producedAt: PRODUCED_AT });
      const blocked = buildContextReadinessReport(blockedContext(), { producedAt: PRODUCED_AT });

      const names = (report: ContextReadinessReport) => report.entries.map((e) => e.capabilityName);

      // Fixed registry order, both times. No sort, no grouping by state.
      expect(names(sample)).toEqual(names(blocked));
      expect(names(sample)).toEqual([
        'Intelligence',
        'Market Discovery',
        'Growth',
        'Authority',
        'Operations',
        'Revenue',
      ]);

      // Only the state values differ; the labels and declarations do not.
      expect(sample.entries.map((e) => e.declaration)).toEqual(
        blocked.entries.map((e) => e.declaration),
      );
      const sampleStates = sample.entries.map((e) => e.state);
      const blockedStates = blocked.entries.map((e) => e.state);
      expect(sampleStates).not.toEqual(blockedStates);
    });
  });

  describe('D7d — no aggregate of any kind', () => {
    it('exposes no key that could be a value across capabilities', () => {
      const report = buildContextReadinessReport(sampleContext(), { producedAt: PRODUCED_AT });

      // Each capability's OWN published thresholds legitimately carry
      // `min...Score` keys. They are asserted by identity below instead, so they
      // are excluded here rather than the pattern being loosened.
      const withoutThresholds: ContextReadinessReport = {
        ...report,
        entries: report.entries.map(({ thresholds: _thresholds, ...rest }) => rest),
      } as ContextReadinessReport;

      const keys = collectKeys(withoutThresholds);
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) {
        expect(key).not.toMatch(/count|total|score|rank|top|best|overall/i);
      }
    });

    it('carries each capability its own thresholds and requiredSectionTypes by value identity', () => {
      const report = buildContextReadinessReport(sampleContext(), { producedAt: PRODUCED_AT });
      const byName = new Map(report.entries.map((e) => [e.capabilityName, e]));

      // Value identity, so a shared constant cannot be substituted silently.
      expect(byName.get('Intelligence')?.thresholds).toBe(BUSINESS_CONTEXT_SUPPORT_THRESHOLDS);
      expect(byName.get('Market Discovery')?.thresholds).toBe(MARKET_CONTEXT_READINESS_THRESHOLDS);
      expect(byName.get('Revenue')?.thresholds).toBe(REVENUE_CONTEXT_READINESS_THRESHOLDS);

      expect(byName.get('Market Discovery')?.requiredSectionTypes).toBe(
        REQUIRED_MARKET_CONTEXT_SECTION_TYPES,
      );
      expect(byName.get('Revenue')?.requiredSectionTypes).toBe(
        REQUIRED_REVENUE_CONTEXT_SECTION_TYPES,
      );

      // Intelligence declares no required set — it judges every present section.
      // `undefined` is the honest value; never an empty array, never a default.
      expect(byName.get('Intelligence')?.requiredSectionTypes).toBeUndefined();

      // The three thresholds objects are genuinely distinct references.
      expect(BUSINESS_CONTEXT_SUPPORT_THRESHOLDS).not.toBe(MARKET_CONTEXT_READINESS_THRESHOLDS);
      expect(MARKET_CONTEXT_READINESS_THRESHOLDS).not.toBe(REVENUE_CONTEXT_READINESS_THRESHOLDS);
    });
  });

  describe('D7e — the registry is unchanged', () => {
    const entries = [
      INTELLIGENCE_CAPABILITY_ENTRY,
      MARKET_DISCOVERY_CAPABILITY_ENTRY,
      GROWTH_CAPABILITY_ENTRY,
      AUTHORITY_CAPABILITY_ENTRY,
      OPERATIONS_CAPABILITY_ENTRY,
      REVENUE_CAPABILITY_ENTRY,
    ];

    it('finds all six registry entries before asserting anything about them', () => {
      expect(entries).toHaveLength(6);
      for (const entry of entries) {
        expect(Array.isArray(entry.consumes)).toBe(true);
      }
    });

    it('never lists ScoredBifContext in consumes — this slice is the pressure that would add it', () => {
      for (const entry of entries) {
        expect(entry.consumes).not.toContain('ScoredBifContext');
      }
    });

    it('drives non-adopters from declared metadata, never as a deficiency (D5)', () => {
      const report = buildContextReadinessReport(sampleContext(), { producedAt: PRODUCED_AT });
      const byName = new Map(report.entries.map((e) => [e.capabilityName, e]));

      for (const name of ['Growth', 'Authority', 'Operations']) {
        const entry = byName.get(name);
        expect(entry).toBeDefined();
        // `undefined` means "assesses no external context" — the correct default.
        expect(entry?.assessesContext).toBeUndefined();
        // Never a null, 0, "N/A" readiness, and never a defaulted sufficiency.
        expect(entry?.state).toBeUndefined();
        expect(entry?.declaration).toMatch(/does not assess external context/i);
      }
    });
  });

  describe('D8 — scope identifiers stay out of the report shape entirely', () => {
    it('carries no clientId or organizationId anywhere in the report', () => {
      const report = buildContextReadinessReport(sampleContext(), { producedAt: PRODUCED_AT });
      const keys = collectKeys(report);
      expect(keys.length).toBeGreaterThan(0);
      expect(keys).not.toContain('clientId');
      expect(keys).not.toContain('organizationId');

      const strings = collectStrings(report);
      for (const line of strings) {
        expect(line).not.toContain('client-demo-001');
        expect(line).not.toContain('org-demo-001');
      }
    });
  });

  describe('D3 — producedAt is required and no clock is read', () => {
    it('refuses to run without a caller-supplied producedAt', () => {
      expect(() =>
        buildContextReadinessReport(sampleContext(), {
          producedAt: undefined as unknown as Date,
        }),
      ).toThrow(/producedAt/i);
    });

    it('is byte-identical across repeated calls with the same inputs', () => {
      const first = buildContextReadinessReport(sampleContext(), { producedAt: PRODUCED_AT });
      const second = buildContextReadinessReport(sampleContext(), { producedAt: PRODUCED_AT });
      expect(JSON.stringify(first)).toEqual(JSON.stringify(second));
    });
  });
});
