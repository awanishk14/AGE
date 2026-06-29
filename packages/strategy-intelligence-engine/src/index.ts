/**
 * @age/strategy-intelligence-engine — the Strategy Intelligence Engine (SIE).
 *
 * The Decision Layer. Consumes BIF, RIE and BKG (by reference) and produces
 * structured decision objects: opportunities, recommendations, priority scores,
 * roadmap items, simulations and a DecisionPackage.
 *
 * It is NOT an execution engine: no SEO, ads, content or client-data changes.
 * It never writes to BIF/RIE/BKG. Contracts, types, enums and Zod schemas only —
 * no formulas, no calculations, no runtime logic.
 *
 * Flow: Evidence → Business Truth → Opportunity Discovery → Prioritization →
 * Recommendations → Roadmap → Simulation → Decision Package.
 */
export const AGE_SIE_PACKAGE = '@age/strategy-intelligence-engine' as const;

export * from './types';
export * from './analysis';
export * from './opportunities';
export * from './prioritization';
export * from './recommendations';
export * from './roadmaps';
export * from './simulation';
export * from './scoring';
export * from './interfaces';
export * from './orchestrator';
export * from './validators';
