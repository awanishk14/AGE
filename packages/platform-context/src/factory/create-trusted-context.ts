import {
  createHumanOperatorContext,
  createSystemActorContext,
  type CreateOperatorContextInput,
} from './create-operator-context';
import { createTenantScope, type CreateTenantScopeInput } from './create-tenant-scope';
import type { OperatorActorKind } from '../types/operator-context';
import type { TrustedOperatorTenantContext } from '../types/trusted-context';

export interface CreateTrustedContextInput {
  readonly operatorKind: OperatorActorKind;
  readonly operator: CreateOperatorContextInput;
  readonly scope: CreateTenantScopeInput;
}

/**
 * The only way to construct a TrustedOperatorTenantContext. Every field is
 * validated by the underlying id factories; empty/invalid input fails
 * deterministically here rather than producing a partially-trusted context.
 */
export function createTrustedOperatorTenantContext(
  input: CreateTrustedContextInput,
): TrustedOperatorTenantContext {
  const operator =
    input.operatorKind === 'human'
      ? createHumanOperatorContext(input.operator)
      : createSystemActorContext(input.operator);

  return {
    operator,
    scope: createTenantScope(input.scope),
  };
}
