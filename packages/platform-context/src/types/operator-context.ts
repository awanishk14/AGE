import type { OperatorId } from './operator-id';

/**
 * OperatorActorKind — distinguishes a verified human operator from a
 * distinguishable system actor (ADR-0024 §1). No third, implicit, or
 * anonymous kind exists.
 */
export type OperatorActorKind = 'human' | 'system';

export interface HumanOperatorContext {
  readonly kind: 'human';
  readonly operatorId: OperatorId;
}

export interface SystemActorContext {
  readonly kind: 'system';
  readonly operatorId: OperatorId;
}

/**
 * OperatorContext — the trusted operator identity attached to a request.
 * Constructible only through the factories in ./factory (never a bare
 * object literal), so no anonymous or default operator context can exist.
 */
export type OperatorContext = HumanOperatorContext | SystemActorContext;
