import { operatorId } from '../types/operator-id';
import type { HumanOperatorContext, SystemActorContext } from '../types/operator-context';

export interface CreateOperatorContextInput {
  readonly operatorId: string;
}

export function createHumanOperatorContext(
  input: CreateOperatorContextInput,
): HumanOperatorContext {
  return { kind: 'human', operatorId: operatorId(input.operatorId) };
}

export function createSystemActorContext(input: CreateOperatorContextInput): SystemActorContext {
  return { kind: 'system', operatorId: operatorId(input.operatorId) };
}
