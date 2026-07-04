import type { ExecutionDomain } from '@age/capability-kit';
import type { AuthorityPlanType } from './enums';
import type { AuthorityPlanReference } from './authority-plan-reference';

/**
 * AuthorityPlanningInputItem — a single neutral, read-only planning input the
 * Authority Capability reasons over (ADR-0017). Derived upstream; Authority does
 * not collect it. Data contract only — no behavior.
 *
 * `planType` is caller-provided (the same upstream concept can support different
 * authority plays depending on caller strategy, so Authority carries planType
 * rather than deriving it). `expectedImpact`, `confidence`, and `estimatedEffort`
 * are the ONLY fields scoring may read — all scoring inputs are explicit here (no
 * channel/source-tier weighting).
 *
 * `executionDomains` here are AUTHORITATIVE for the derived plan (validation,
 * candidate/output execution domains, and the output envelope union). They
 * express Authority planning intent and are not overridden by
 * `reference.executionDomains` (which is upstream provenance context only).
 */
export interface AuthorityPlanningInputItem {
  readonly id: string;
  readonly planType: AuthorityPlanType;
  readonly reference: AuthorityPlanReference;
  /** Opaque structural tags (from `@age/capability-kit`); never branched on. */
  readonly executionDomains: readonly ExecutionDomain[];
  /** 0–100. Explicit scoring input. */
  readonly expectedImpact: number;
  /** 0–100. Explicit scoring input. */
  readonly confidence: number;
  /** 0–100. Explicit scoring input. */
  readonly estimatedEffort: number;
}

/**
 * AuthorityInput — the in-memory input contract for a single Authority
 * invocation (ADR-0017). Caller-assembled; Authority reads no datastore and does
 * not depend on persisted upstream output.
 *
 * `generatedAt` is the caller-supplied run timestamp (ISO); it is the only time
 * source the capability uses (e.g. for output-item createdAt) — no internal
 * clock reads.
 *
 * Client/organization authority invariant (enforced from the capability layer,
 * not by this contract type):
 *  - `ClientContext.clientId` / `ClientContext.organizationId` are AUTHORITATIVE
 *    for the produced `CapabilityOutput`.
 *  - `AuthorityInput.clientId` / `AuthorityInput.organizationId` are PROVENANCE /
 *    SCOPE fields describing the input batch.
 *  - Any future mismatch between the two must be handled by an explicit
 *    validation rule (and, if it changes behavior, an ADR update) — never
 *    silently ignored or guessed.
 */
export interface AuthorityInput {
  readonly clientId: string;
  readonly organizationId: string;
  readonly planningItems: readonly AuthorityPlanningInputItem[];
  readonly generatedAt: string;
}
