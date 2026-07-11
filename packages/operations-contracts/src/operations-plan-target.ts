import type { OperationsPlanTargetKind } from './enums';

/**
 * OperationsPlanTarget — a structural planning target identity (ADR-0018).
 * `key` is an opaque upstream identity string; Operations never dereferences it.
 */
export interface OperationsPlanTarget {
  readonly kind: OperationsPlanTargetKind;
  readonly key: string;
}
