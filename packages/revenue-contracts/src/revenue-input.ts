import type { ExecutionDomain } from '@age/capability-kit';
import type { RevenuePlanType } from './enums';
import type { RevenuePlanReference } from './revenue-plan-reference';

/**
 * RevenuePlanningInputItem — a neutral, read-only planning input the capability
 * reasons over (ADR-0019). Derived upstream; Revenue does not collect it.
 * `executionDomains` are opaque structural tags (from @age/capability-kit) and
 * are authoritative for this planning item; Revenue never branches on them.
 * `reference.executionDomains`, by contrast, are provenance/context only.
 *
 * Explicit scoring inputs (`expectedValue`, `conversionProbability`,
 * `retentionRisk`, `estimatedEffort`, `confidence`) are carried as plain 0–100
 * values. No scoring is performed in T36 — the contract only declares the
 * fields.
 */
export interface RevenuePlanningInputItem {
  readonly id: string;
  readonly planType: RevenuePlanType;
  readonly reference: RevenuePlanReference;

  /** Opaque structural tags; authoritative for this planning item. */
  readonly executionDomains: readonly ExecutionDomain[];

  /** Explicit scoring inputs — all normalized 0–100. */
  readonly expectedValue: number;
  readonly conversionProbability: number;
  readonly retentionRisk: number;
  readonly estimatedEffort: number;
  readonly confidence: number;

  /**
   * Advisory flag only. Means Revenue recommends that a proposal be drafted later.
   * Decision data only — must never generate proposal content, send a proposal,
   * or invoke document/email/workflow engines, or trigger any other side effect.
   */
  readonly recommendsProposalDraft?: boolean;

  /** Raw provenance metadata only; never used in scoring. */
  readonly monetaryAmount?: number;

  /** Raw provenance metadata only; never used in scoring. */
  readonly currency?: string;
}

/**
 * RevenueInput — the top-level in-memory input contract for a single Revenue
 * invocation (ADR-0019). Caller-assembled and fully in-memory: Revenue reads no
 * datastore and does not depend on persisted upstream output.
 *
 * `clientId` / `organizationId` are provenance/scope fields ONLY and must never
 * be used to scope produced output — `ClientContext` remains authoritative for
 * output scoping at the capability layer later.
 */
export interface RevenueInput {
  readonly clientId: string;
  readonly organizationId: string;
  readonly planningItems: readonly RevenuePlanningInputItem[];
  readonly generatedAt: string;
}
