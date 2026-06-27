import type { UniqueId } from '../unique-id';

/**
 * Typed identifiers for every AGE domain concept.
 *
 * There is ONE identity concept in AGE: `UniqueId`. These are nominal (branded)
 * aliases over it, giving compile-time safety (an `OrganizationId` cannot be
 * passed where a `ProductId` is expected) without a second identifier type.
 *
 * Placeholder: no runtime construction is defined here.
 */
type Branded<TBrand extends string> = UniqueId & { readonly __idBrand: TBrand };

export type OrganizationId = Branded<'Organization'>;
export type PeopleId = Branded<'People'>;
export type PersonId = Branded<'Person'>;
export type BrandId = Branded<'Brand'>;
export type ProductId = Branded<'Product'>;
export type ServiceId = Branded<'Service'>;
export type MarketId = Branded<'Market'>;
export type IcpId = Branded<'Icp'>;
export type CompetitorId = Branded<'Competitor'>;
export type StrategyId = Branded<'Strategy'>;
export type GoalId = Branded<'Goal'>;
export type InitiativeId = Branded<'Initiative'>;
export type CampaignId = Branded<'Campaign'>;
export type ContentId = Branded<'Content'>;
export type ResearchId = Branded<'Research'>;
export type EvidenceId = Branded<'Evidence'>;
export type KnowledgeId = Branded<'Knowledge'>;
export type DecisionId = Branded<'Decision'>;
export type ProjectId = Branded<'Project'>;
export type WorkflowId = Branded<'Workflow'>;
export type IntegrationId = Branded<'Integration'>;
export type ReportingId = Branded<'Reporting'>;
export type ProblemId = Branded<'Problem'>;
export type OpportunityId = Branded<'Opportunity'>;
export type MetricId = Branded<'Metric'>;
export type DocumentId = Branded<'Document'>;
export type MeetingId = Branded<'Meeting'>;
export type TechnologyId = Branded<'Technology'>;
export type AssetId = Branded<'Asset'>;
