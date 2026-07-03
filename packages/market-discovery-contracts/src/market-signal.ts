import type { ExecutionDomain } from '@age/capability-kit';
import type { MarketSignalTargetKind, MarketSignalType } from './enums';
import type { BifFieldReference } from './references';

/**
 * MarketSignalTarget — the structural identity a signal addresses. Used for
 * deterministic derivation and structural deduplication. `key` is a normalized
 * identity string (e.g. "crm software", "competitor:acme").
 */
export interface MarketSignalTarget {
  readonly kind: MarketSignalTargetKind;
  readonly key: string;
}

/**
 * MarketSignal — a single observed market signal Market Discovery reasons over
 * (ADR-0012). Data contract only — no behavior.
 *
 * `strength`, `confidence`, and `demandVolume` are the ONLY fields opportunity
 * scoring may read; all scoring inputs are explicit here (no source-tier /
 * source-reliability weighting — deferred). `executionDomains` are carried as
 * opaque structural tags and are never interpreted by the capability. `bifFields`
 * is optional read-only provenance and is not scored.
 */
export interface MarketSignal {
  readonly id: string;
  readonly type: MarketSignalType;
  readonly target: MarketSignalTarget;
  /** Opaque structural tags (from `@age/capability-kit`); never branched on. */
  readonly executionDomains: readonly ExecutionDomain[];
  /** 0–100. Explicit scoring input. */
  readonly strength: number;
  /** 0–100. Explicit scoring input. */
  readonly confidence: number;
  /** >= 0, normalized volume/size indicator. Explicit scoring input. */
  readonly demandVolume: number;
  /** ISO timestamp — provenance only, not scored. */
  readonly observedAt: string;
  /** Optional read-only BIF-field provenance. Not scored. */
  readonly bifFields?: readonly BifFieldReference[];
}
