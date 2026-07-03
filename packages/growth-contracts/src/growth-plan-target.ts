import type { GrowthPlanTargetKind } from './enums';

/**
 * GrowthPlanTarget — the structural identity a growth plan addresses.
 *
 * This is a GROWTH planning target, not a Market Discovery target import or an
 * exact mirror of Market Discovery's target model. It identifies what a Growth
 * plan should address and may represent the originating opportunity simply as
 * `{ kind: 'OPPORTUNITY', key: opportunityId }`. It is not required to preserve
 * the original Market Discovery target kind. `key` is a normalized identity
 * string (e.g. "opp:signal-1", "funnel:checkout").
 */
export interface GrowthPlanTarget {
  readonly kind: GrowthPlanTargetKind;
  readonly key: string;
}
