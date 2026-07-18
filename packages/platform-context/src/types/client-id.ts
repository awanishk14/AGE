export type ClientId = string & { readonly __brand: 'ClientId' };

export function clientId(value: string): ClientId {
  if (value.trim().length === 0) {
    throw new Error('clientId must not be empty');
  }
  return value as ClientId;
}
