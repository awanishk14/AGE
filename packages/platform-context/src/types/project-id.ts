export type ProjectId = string & { readonly __brand: 'ProjectId' };

export function projectId(value: string): ProjectId {
  if (value.trim().length === 0) {
    throw new Error('projectId must not be empty');
  }
  return value as ProjectId;
}
