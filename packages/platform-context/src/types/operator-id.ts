export type OperatorId = string & { readonly __brand: 'OperatorId' };

export function operatorId(value: string): OperatorId {
  if (value.trim().length === 0) {
    throw new Error('operatorId must not be empty');
  }
  return value as OperatorId;
}
