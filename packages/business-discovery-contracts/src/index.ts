// Enums / structural classification types + their Zod schemas.
export {
  DISCOVERY_SECTION_IDS,
  DISCOVERY_QUESTION_KINDS,
  OFFERING_KINDS,
  EVIDENCE_SOURCE_KINDS,
  GOAL_HORIZONS,
  ASSUMPTION_CONFIDENCE,
  GAP_SEVERITIES,
  discoverySectionIdSchema,
  discoveryQuestionKindSchema,
  offeringKindSchema,
  evidenceSourceKindSchema,
  goalHorizonSchema,
  assumptionConfidenceSchema,
  gapSeveritySchema,
} from './enums';
export type {
  DiscoverySectionId,
  DiscoveryQuestionKind,
  OfferingKind,
  EvidenceSourceKind,
  GoalHorizon,
  AssumptionConfidence,
  GapSeverity,
} from './enums';

// Domain model types + their Zod schemas.
export { evidenceSourceRefSchema } from './evidence-source-ref';
export type { EvidenceSourceRef } from './evidence-source-ref';

export { customerSegmentSchema } from './customer-segment';
export type { CustomerSegment } from './customer-segment';

export { offeringSchema } from './offering';
export type { Offering } from './offering';

export { competitorReferenceSchema } from './competitor-reference';
export type { CompetitorReference } from './competitor-reference';

export { businessGoalSchema } from './business-goal';
export type { BusinessGoal } from './business-goal';

export { businessAssumptionSchema } from './business-assumption';
export type { BusinessAssumption } from './business-assumption';

export { discoveryGapSchema } from './discovery-gap';
export type { DiscoveryGap } from './discovery-gap';

export { discoveryQuestionSchema } from './discovery-question';
export type { DiscoveryQuestion } from './discovery-question';

export { discoveryAnswerSchema } from './discovery-answer';
export type { DiscoveryAnswer } from './discovery-answer';

export { discoverySectionSchema } from './discovery-section';
export type { DiscoverySection } from './discovery-section';

export { businessDiscoveryProfileSchema } from './business-discovery-profile';
export type { BusinessDiscoveryProfile } from './business-discovery-profile';
