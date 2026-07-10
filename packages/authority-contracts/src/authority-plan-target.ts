import type { AuthorityPlanTargetKind } from './enums';

/**
 * AuthorityPlanTarget — the structural identity an authority plan addresses.
 *
 * A neutral Authority planning target, not a producer import or an exact mirror
 * of any upstream target model. It may represent the originating reference as
 * `{ kind: 'OPPORTUNITY', key: referenceId }`. `key` is a normalized identity
 * string (e.g. "topic:api-security", "entity:techcrunch").
 */
export interface AuthorityPlanTarget {
  readonly kind: AuthorityPlanTargetKind;
  readonly key: string;
}
