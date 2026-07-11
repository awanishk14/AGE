/**
 * Small, structural, neutral classification types for Operations (ADR-0018).
 * String-literal unions — categorization only, never channel or execution
 * logic. Owned here so the capability never imports Market Discovery, Growth,
 * Authority, SIE, BIF, BKG, or RIE.
 *
 * Project-management meaning is represented through `OperationsPlanType` and
 * `OperationsPlanTargetKind` — never through a new `ExecutionDomain` value
 * (no `PM` / `ProjectManagement` domain is introduced).
 */

/**
 * Nature of an operations plan candidate. Caller-provided on the planning
 * input: there is no canonical deterministic upstream -> operations-plan-type
 * mapping, so Operations carries planType rather than inventing delivery
 * strategy. Faithful to CAPABILITY_ARCHITECTURE §7 (Agency Operations).
 * `TEAM_ASSIGNMENT` names an assignment *proposal* only — never execution.
 */
export type OperationsPlanType =
  | 'PROJECT_PLAN'
  | 'CLIENT_REPORTING'
  | 'TEAM_ASSIGNMENT'
  | 'SOP_EXECUTION'
  | 'QA_PLAN'
  | 'DELIVERY_TRACKING';

/** What an operations plan addresses — a structural planning target identity. */
export type OperationsPlanTargetKind =
  'PROJECT' | 'DELIVERABLE' | 'ENGAGEMENT' | 'ASSIGNEE' | 'SOP' | 'REPORT';

/** Deterministic priority band (derived from score later, not free-form). */
export type OperationsPlanPriority = 'LOW' | 'MEDIUM' | 'HIGH';

/** Coarse deterministic effort band (derived from effortScore later). */
export type OperationsEffortBand = 'LOW' | 'MEDIUM' | 'HIGH';
