/**
 * Evidence and EvidenceEntityLink are canonical evidence contract types owned
 * by @age/evidence-contracts (ADR-0010). RIE is a producer of this contract
 * and re-exports the types here so existing internal imports
 * (`../evidence/evidence`) keep working unchanged.
 */
export type { Evidence, EvidenceEntityLink } from '@age/evidence-contracts';
