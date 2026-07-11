import type { RevenuePlanTargetKind } from './enums';

/**
 * RevenuePlanTarget — a structural planning target identity (ADR-0019). `key` is
 * an opaque upstream identity string; Revenue never dereferences or mutates it
 * (it is not a CRM/deal-state handle).
 */
export interface RevenuePlanTarget {
  readonly kind: RevenuePlanTargetKind;
  readonly key: string;
}
