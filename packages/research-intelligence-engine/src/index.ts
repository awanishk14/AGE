/**
 * @age/research-intelligence-engine — the Research Intelligence Engine (RIE).
 *
 * A sensing layer only: it converts external data into Evidence, ExtractedSignals,
 * IntentClusters, BIF mapping PROPOSALS and EvidenceConflicts. It NEVER modifies
 * BIF and contains no scraping, no inference and no business logic — contracts only.
 *
 * Flow: External Data → RIE → BIF → AGE Engines.
 */
export const AGE_RIE_PACKAGE = '@age/research-intelligence-engine' as const;

export * from './types';
export * from './normalizers';
export * from './sources';
export * from './signals';
export * from './evidence';
export * from './intent';
export * from './extractors';
export * from './mapping';
export * from './orchestrator';
export * from './interfaces';
export * from './validators';
