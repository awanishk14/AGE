import type { ExecutionDomain } from '@age/capability-kit';
import type { OperationsPlanType } from './enums';
import type { OperationsPlanReference } from './operations-plan-reference';

/**
 * OperationsPlanningInputItem — a neutral, read-only planning input the
 * capability reasons over (ADR-0018). Derived upstream; Operations does not
 * collect it. `executionDomains` are opaque structural tags (from
 * @age/capability-kit); Operations never branches on them.
 *
 * Explicit scoring inputs (`operationalUrgency`, `deliveryRisk`,
 * `estimatedEffort`, `confidence`) are carried as plain 0–100 values. No scoring
 * is performed in T31 — the contract only declares the fields.
 */
export interface OperationsPlanningInputItem {
  readonly id: string;
  readonly planType: OperationsPlanType;
  readonly reference: OperationsPlanReference;
  /** Opaque structural tags (from @age/capability-kit); never branched on. */
  readonly executionDomains: readonly ExecutionDomain[];
  /** 0–100. Explicit scoring input — deadline/operational time pressure. */
  readonly operationalUrgency: number;
  /** 0–100. Explicit scoring input — delivery/QA risk. */
  readonly deliveryRisk: number;
  /** 0–100. Explicit scoring input — capacity/effort cost. */
  readonly estimatedEffort: number;
  /** 0–100. Explicit scoring input — confidence in inputs. */
  readonly confidence: number;
}

/**
 * OperationsInput — the top-level in-memory input contract for a single
 * Operations invocation (ADR-0018). Caller-assembled and fully in-memory:
 * Operations reads no datastore.
 *
 * `clientId` / `organizationId` are provenance/scope fields ONLY and must never
 * be used to scope produced output — `ClientContext` remains authoritative for
 * output scoping at the capability layer later.
 */
export interface OperationsInput {
  readonly clientId: string;
  readonly organizationId: string;
  readonly planningItems: readonly OperationsPlanningInputItem[];
  readonly generatedAt: string;
}
