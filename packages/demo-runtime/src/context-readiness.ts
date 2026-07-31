import type { ScoredBifContext } from '@age/business-discovery-contracts';

import {
  INTELLIGENCE_CAPABILITY_ENTRY,
  BUSINESS_CONTEXT_SUPPORT_THRESHOLDS,
  assessScoredBifContext,
  type BusinessContextSupportThresholds,
} from '@age/capability-intelligence';
import {
  MARKET_DISCOVERY_CAPABILITY_ENTRY,
  MARKET_CONTEXT_READINESS_THRESHOLDS,
  REQUIRED_MARKET_CONTEXT_SECTION_TYPES,
  assessMarketContextReadiness,
  type MarketContextReadinessThresholds,
} from '@age/capability-market-discovery';
import {
  REVENUE_CAPABILITY_ENTRY,
  REVENUE_CONTEXT_READINESS_THRESHOLDS,
  REQUIRED_REVENUE_CONTEXT_SECTION_TYPES,
  assessRevenueContextReadiness,
  type RevenueContextReadinessThresholds,
} from '@age/capability-revenue';
import { GROWTH_CAPABILITY_ENTRY } from '@age/capability-growth';
import { AUTHORITY_CAPABILITY_ENTRY } from '@age/capability-authority';
import { OPERATIONS_CAPABILITY_ENTRY } from '@age/capability-operations';

import { demoContext } from './fixtures';

/**
 * Context readiness — the demo's THIRD pipeline stage (ADR-0047 D1).
 *
 *     intake  →  context readiness  →  capability runs
 *
 * This is the first non-test caller of the ADR-0027 readiness pattern. Three of
 * the six capabilities adopt it; the pattern was written and never read, and a
 * pattern with no caller is indistinguishable from one that does not work.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ THE HAZARD IS IN THE RENDERING, NOT THE WIRING (ADR-0047 §1.1).
 *
 * ADR-0027 D1 forbids an assessment to "derive, rank, score, shortlist, name or
 * hint at" any plan, opportunity, action or recommendation. THREE of those six
 * verbs — rank, score, shortlist — are acts of a PRESENTATION layer, not of an
 * assessment function. Each assessor obeys the constraint; a surface that puts
 * three capabilities' readiness states in one column is what performs the acts
 * it names.
 *
 * The three states are INCOMMENSURABLE by ADR-0027 D2's own reasoning, which
 * declined a shared threshold because it "would assert they are the same, which
 * nothing has established." They differ in DENOMINATOR, not merely in threshold:
 *
 *   - Market Discovery requires icp_personas, products_services, market_competition
 *   - Revenue          requires icp_personas, products_services, gtm_system
 *   - Intelligence     declares no required set and judges every present section
 *
 * So this module, binding on every rendering now and later (ADR-0047 D4):
 *
 *   - emits in FIXED registry order; never sorts, groups or reorders by state;
 *   - places each state adjacent to its OWN thresholds and its OWN required set,
 *     because a state shown without its denominator invites the comparison
 *     ADR-0027 D2 refused;
 *   - derives NO aggregate of any kind — no "overall readiness", no combined
 *     value, no "2 of 3 ready", no "most ready", no badge or colour scale. Any
 *     number that is a function of more than one capability's readiness invents
 *     the shared scale three ADRs went out of their way not to create;
 *   - states the incommensurability ON the surface rather than leaving it
 *     implicit.
 *
 * ⚠️ `ready` gets special care. ADR-0027 closes with `ready` "never means a BIF
 * may be promoted." A surface showing `ready` beside a `Draft` BIF invites
 * exactly that read, so the notice below says so in words. NEVER promote BIF
 * status.
 *
 * ⚠️ This stage NEVER gates `run`. The six capability runs are byte-identical
 * whatever readiness says, and ADR-0047 D7b is the only test that can prove it —
 * a source-scan of the capability packages could not, because a gate introduced
 * here would live in demo-runtime, not in a capability.
 *
 * ⚠️ Scope identifiers are kept out of this shape ENTIRELY (ADR-0047 D8). The
 * assessors stamp `clientId`/`organizationId` from the `ClientContext` argument;
 * publishing those over the read-only demo endpoint would put scope identifiers
 * in a public payload for the first time. Keeping them out here means that
 * question stays open rather than being decided by omission.
 *
 * Pure and deterministic: no clock, no I/O, no randomness, no persistence.
 */

/**
 * The thresholds a capability published with its own assessment.
 *
 * ⚠️ A UNION OF THE THREE PUBLISHED TYPES, deliberately — NOT a flattened
 * `Record<string, number>`. Each adopter publishes a differently-shaped
 * threshold set because each judges a different denominator (ADR-0047 D4);
 * collapsing them into one index signature would assert a common shape they do
 * not have, and would let a future edit swap one capability's thresholds for
 * another's without the compiler objecting. The constants are carried through by
 * reference, never copied or normalized.
 */
export type ContextReadinessThresholds =
  | BusinessContextSupportThresholds
  | MarketContextReadinessThresholds
  | RevenueContextReadinessThresholds;

/**
 * One capability's row. Adopters carry a state; non-adopters carry none.
 *
 * ⚠️ For a non-adopter, `state`, `reasons`, `thresholds` and
 * `requiredSectionTypes` are all `undefined` — never `null`, never `0`, never
 * `"N/A"`, and never a defaulted `sufficiency` (ADR-0047 D5). There is no honest
 * value to put there, and inventing one would render non-adoption as a
 * deficiency rather than a declared property.
 */
export interface ContextReadinessEntry {
  readonly capabilityName: string;
  /**
   * Copied from the capability's own registry entry. `undefined` means the
   * capability assesses no external context — the correct default for a
   * non-adopter, per the kit's own documented answer.
   */
  readonly assessesContext?: readonly string[];
  /** A plain sentence naming what this row is. Never a ranking or a verdict. */
  readonly declaration: string;
  /** The sufficiency state verbatim from the assessor. Adopters only. */
  readonly state?: string;
  /** Why the assessor is in that state, carried through unsuppressed. */
  readonly reasons?: readonly string[];
  /** What limits the assessment, phrased about the context. */
  readonly limitations?: readonly string[];
  /** What context would raise readiness — never what to conclude. */
  readonly improvementHints?: readonly string[];
  /**
   * This capability's OWN denominator, by reference to the capability's own
   * exported constant. `undefined` for Intelligence, which declares no required
   * set, and for non-adopters.
   */
  readonly requiredSectionTypes?: readonly string[];
  /** This capability's OWN published thresholds, by reference. */
  readonly thresholds?: ContextReadinessThresholds;
  /** States the denominator in words, so the row is readable without the ADRs. */
  readonly denominator?: string;
}

/** The whole readiness stage. Deliberately carries no aggregate and no scope. */
export interface ContextReadinessReport {
  /**
   * The incommensurability, stated ON the surface (ADR-0047 D4). Not a footnote
   * a reader may skip: without it, three states in one list read as a scale.
   */
  readonly incommensurabilityNotice: readonly string[];
  /** Fixed registry order. Never sorted, never grouped, never reordered. */
  readonly entries: readonly ContextReadinessEntry[];
}

export interface BuildContextReadinessReportOptions {
  /**
   * Caller-supplied, ALWAYS. ⚠️ Never `new Date()`: a readiness envelope stamped
   * with a live clock would make `sample-output.txt`'s determinism note false,
   * and the fix would then be to hand-filter output to protect a golden file
   * (ADR-0047 D3).
   */
  readonly producedAt: Date;
}

/**
 * The notice. Written here, in the demo layer, and therefore scanned by
 * ADR-0047 D7a — nothing else constrains prose this layer authors.
 */
const INCOMMENSURABILITY_NOTICE: readonly string[] = Object.freeze([
  'These readiness states are NOT comparable with one another. Each capability judges a ' +
    'different set of BIF sections against its own published thresholds, so the states differ ' +
    'in what they measure, not merely in where a line was drawn.',
  'No value here is computed across capabilities, and the rows are never ordered by state. ' +
    'There is deliberately no single figure summarising them, because no shared scale exists ' +
    'in which one could be expressed.',
  'A capability reporting "ready" means only that the captured context carries it that far. ' +
    'It never means the Draft BIF may be promoted, and no work is derived from any state below.',
]);

/** Registry order — the same six, in the same order, as the capability runs. */
const REGISTRY_ORDER = [
  INTELLIGENCE_CAPABILITY_ENTRY,
  MARKET_DISCOVERY_CAPABILITY_ENTRY,
  GROWTH_CAPABILITY_ENTRY,
  AUTHORITY_CAPABILITY_ENTRY,
  OPERATIONS_CAPABILITY_ENTRY,
  REVENUE_CAPABILITY_ENTRY,
] as const;

/**
 * Display names, matching the capability run reports exactly so a reader sees
 * one set of six names across both stages. Only `MarketDiscovery` differs from
 * its enum value; the rest are mapped explicitly rather than by a spacing rule,
 * so a future enum member cannot be silently renamed by a regex.
 */
const DISPLAY_NAMES: Readonly<Record<string, string>> = Object.freeze({
  Intelligence: 'Intelligence',
  MarketDiscovery: 'Market Discovery',
  Growth: 'Growth',
  Authority: 'Authority',
  Operations: 'Operations',
  Revenue: 'Revenue',
});

function displayName(entryName: unknown): string {
  const key = String(entryName);
  return DISPLAY_NAMES[key] ?? key;
}

/**
 * buildContextReadinessReport — assess the demo's scored context with each
 * adopting capability and return a print-ready, non-ranking report.
 *
 * The `ClientContext` passed to the assessors is `demoContext`, unchanged
 * (ADR-0047 D9). ⚠️ It diverges from `DEMO_SCENARIO_METADATA.organizationId`,
 * under which the BIF was authored. That divergence is RECORDED, not reconciled:
 * `ScoredBifContext` carries no scope — scope does not survive the projection —
 * so the assessment's FINDINGS are correct either way and only the envelope
 * diverges, and the envelope is not published here (D8). Do NOT "align" them by
 * building a context from the scenario org: ADR-0039 says that value "is not a
 * tenant, it is not scope, and it must never be treated as one."
 */
export function buildContextReadinessReport(
  scoredBifContext: ScoredBifContext,
  options: BuildContextReadinessReportOptions,
): ContextReadinessReport {
  if (!(options?.producedAt instanceof Date)) {
    throw new Error(
      'buildContextReadinessReport requires a caller-supplied producedAt (ADR-0047 D3); this stage never reads the wall clock',
    );
  }
  // Copied so a caller's reference cannot be mutated through ours, and so the
  // shallow-frozen scenario Date cannot travel into three assessors by reference.
  const producedAt = new Date(options.producedAt.getTime());

  const intelligence = assessScoredBifContext(demoContext, scoredBifContext, { producedAt });
  const marketDiscovery = assessMarketContextReadiness(demoContext, scoredBifContext, {
    producedAt,
  });
  const revenue = assessRevenueContextReadiness(demoContext, scoredBifContext, { producedAt });

  const assessed: Readonly<Record<string, ContextReadinessEntry>> = {
    Intelligence: {
      capabilityName: 'Intelligence',
      assessesContext: INTELLIGENCE_CAPABILITY_ENTRY.assessesContext,
      declaration: 'assesses the scored BIF context and reports how far it carries this capability',
      state: String(intelligence.output.sufficiency?.state),
      reasons: intelligence.output.sufficiency?.reasons,
      limitations: intelligence.summary.limitations,
      improvementHints: intelligence.summary.improvementHints,
      // Declares no required set — it judges every present section instead.
      requiredSectionTypes: undefined,
      thresholds: BUSINESS_CONTEXT_SUPPORT_THRESHOLDS,
      denominator: 'judges every BIF section present in the context; declares no required set',
    },
    'Market Discovery': {
      capabilityName: 'Market Discovery',
      assessesContext: MARKET_DISCOVERY_CAPABILITY_ENTRY.assessesContext,
      declaration: 'assesses the scored BIF context and reports how far it carries this capability',
      state: String(marketDiscovery.output.sufficiency?.state),
      reasons: marketDiscovery.output.sufficiency?.reasons,
      limitations: marketDiscovery.summary.limitations,
      improvementHints: marketDiscovery.summary.improvementHints,
      requiredSectionTypes: REQUIRED_MARKET_CONTEXT_SECTION_TYPES,
      thresholds: MARKET_CONTEXT_READINESS_THRESHOLDS,
      denominator: 'judges only the BIF sections it declares it requires',
    },
    Revenue: {
      capabilityName: 'Revenue',
      assessesContext: REVENUE_CAPABILITY_ENTRY.assessesContext,
      declaration: 'assesses the scored BIF context and reports how far it carries this capability',
      state: String(revenue.output.sufficiency?.state),
      reasons: revenue.output.sufficiency?.reasons,
      limitations: revenue.summary.limitations,
      improvementHints: revenue.summary.improvementHints,
      requiredSectionTypes: REQUIRED_REVENUE_CONTEXT_SECTION_TYPES,
      thresholds: REVENUE_CONTEXT_READINESS_THRESHOLDS,
      denominator: 'judges only the BIF sections it declares it requires',
    },
  };

  // Driven from the SIX registry entries, not a hardcoded list of three
  // (ADR-0047 D5). A capability that adopts the pattern later appears here by
  // declaring it, and a non-adopter renders from its own declared metadata.
  const entries = REGISTRY_ORDER.map((registryEntry): ContextReadinessEntry => {
    const name = displayName(registryEntry.name);
    const adopted = assessed[name];
    if (adopted !== undefined) return adopted;

    return {
      capabilityName: name,
      // `undefined`, carried through as declared. Never rendered as missing.
      assessesContext: registryEntry.assessesContext,
      declaration: 'does not assess external context — this capability declares none',
    };
  });

  return { incommensurabilityNotice: INCOMMENSURABILITY_NOTICE, entries };
}
