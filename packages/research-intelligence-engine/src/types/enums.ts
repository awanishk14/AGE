/**
 * EvidenceSource, SignalType, EvidenceState, and Polarity are canonical
 * evidence contract types owned by @age/evidence-contracts (ADR-0010).
 * RIE is a producer of that contract and re-exports them here so existing
 * internal imports (`../types/enums`) keep working unchanged.
 */
export { EvidenceSource, SignalType, EvidenceState, Polarity } from '@age/evidence-contracts';

/** The action a BIF mapping proposal recommends. RIE proposes; it never applies. */
export enum BIFMappingAction {
  PROPOSE_UPDATE = 'PROPOSE_UPDATE',
  INCREASE_CONFIDENCE = 'INCREASE_CONFIDENCE',
  FLAG_CONFLICT = 'FLAG_CONFLICT',
  ADD_DERIVED_VALUE = 'ADD_DERIVED_VALUE',
}

/** Severity of a detected evidence conflict. */
export enum ConflictSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}
