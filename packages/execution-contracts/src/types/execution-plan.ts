import type { ExecutionDomain } from '@age/capability-kit';
import type { ExecutionId } from './execution-id';
import { ExecutionMode } from '../enums';

/**
 * ExecutionPlanStep — one descriptive fulfillment step. In this slice a step is
 * purely descriptive; it never carries an executable action (the action catalog
 * is out of scope, Doc 12).
 */
export interface ExecutionPlanStep {
  readonly order: number;
  readonly executionDomain: ExecutionDomain;
  readonly description: string;
}

/**
 * ExecutionPlan — the validated, ordered fulfillment derived from an approved
 * request (ADR-0021 §2). Fulfillment only; the plan never originates intent.
 */
export interface ExecutionPlan {
  readonly executionId: ExecutionId;
  readonly mode: ExecutionMode;
  readonly steps: readonly ExecutionPlanStep[];
}
