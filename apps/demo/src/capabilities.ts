import type { CapabilityOutputItem } from '@age/capability-kit';
import { IntelligenceCapability } from '@age/capability-intelligence';
import { MarketDiscoveryCapability } from '@age/capability-market-discovery';
import { GrowthCapability } from '@age/capability-growth';
import { AuthorityCapability } from '@age/capability-authority';
import { OperationsCapability } from '@age/capability-operations';
import { RevenueCapability } from '@age/capability-revenue';

import {
  demoContext,
  intelligenceInput,
  marketDiscoveryInput,
  growthInput,
  authorityInput,
  operationsInput,
  revenueInput,
} from './fixtures';

/**
 * Structural shape shared by every capability's result (ADR-0016). The demo
 * only reads these common fields, so it can treat all six results uniformly
 * without importing each capability's concrete result type.
 */
interface CapabilityResultShape {
  readonly output: { readonly items: readonly CapabilityOutputItem[] };
  readonly summary: {
    readonly acceptedCount: number;
    readonly rejectedCount: number;
    readonly duplicateCount: number;
    readonly rejectedReasons: readonly unknown[];
    readonly duplicateReferences: readonly unknown[];
  };
}

/** A uniform, print-ready report for one capability run. Pure data — no I/O. */
export interface CapabilityRunReport {
  readonly name: string;
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly duplicateCount: number;
  /** accepted + rejected + duplicate. */
  readonly derivedCount: number;
  /** Number of items supplied in the fixture input. */
  readonly inputItemCount: number;
  /** True when derivedCount === inputItemCount (no silent disappearance). */
  readonly accountingHolds: boolean;
  /** Accepted decision objects — what a human would review/approve. */
  readonly acceptedItems: readonly CapabilityOutputItem[];
  readonly rejectedReasons: readonly unknown[];
  readonly duplicateReferences: readonly unknown[];
  /** Capability-specific extra counters (e.g. Intelligence contradictionCount). */
  readonly extra?: Readonly<Record<string, number>>;
}

function toReport(
  name: string,
  result: CapabilityResultShape,
  inputItemCount: number,
  extra?: Readonly<Record<string, number>>,
): CapabilityRunReport {
  const { acceptedCount, rejectedCount, duplicateCount, rejectedReasons, duplicateReferences } =
    result.summary;
  const derivedCount = acceptedCount + rejectedCount + duplicateCount;

  return {
    name,
    acceptedCount,
    rejectedCount,
    duplicateCount,
    derivedCount,
    inputItemCount,
    accountingHolds: derivedCount === inputItemCount,
    acceptedItems: result.output.items,
    rejectedReasons,
    duplicateReferences,
    extra,
  };
}

/**
 * Run all six pure capabilities against the demo fixtures, in-memory, and return
 * uniform reports. No side effects: no persistence, queues, events, external
 * APIs, AI/LLM, or execution behavior — this stays strictly within
 * Human-Approved Execution (decision objects only). Deterministic except for the
 * `producedAt` envelope timestamp inherited from CapabilityOutput.
 */
export async function runAllCapabilities(): Promise<readonly CapabilityRunReport[]> {
  const intelligence = await new IntelligenceCapability().run(demoContext, intelligenceInput);
  const marketDiscovery = await new MarketDiscoveryCapability().run(
    demoContext,
    marketDiscoveryInput,
  );
  const growth = await new GrowthCapability().run(demoContext, growthInput);
  const authority = await new AuthorityCapability().run(demoContext, authorityInput);
  const operations = await new OperationsCapability().run(demoContext, operationsInput);
  const revenue = await new RevenueCapability().run(demoContext, revenueInput);

  return [
    toReport('Intelligence', intelligence, intelligenceInput.evidence.length, {
      contradictionCount: intelligence.summary.contradictionCount,
    }),
    toReport('Market Discovery', marketDiscovery, marketDiscoveryInput.signals.length),
    toReport('Growth', growth, growthInput.planningItems.length),
    toReport('Authority', authority, authorityInput.planningItems.length),
    toReport('Operations', operations, operationsInput.planningItems.length),
    toReport('Revenue', revenue, revenueInput.planningItems.length),
  ];
}
