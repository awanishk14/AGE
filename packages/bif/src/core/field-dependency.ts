import { z } from 'zod';

/**
 * FieldDependency — declares that one field is derived from another.
 *
 * Structural contract only. This package contains NO dependency graph traversal,
 * NO computation engine and NO automatic recalculation. It records *that* a
 * derivation exists so future engines (and humans) can explain and trace it.
 */
export interface FieldDependency {
  readonly sourceField: string;
  readonly derivedField: string;
  readonly transformationType: string;
  readonly confidencePropagationRule: string;
}

export const fieldDependencySchema = z.object({
  sourceField: z.string(),
  derivedField: z.string(),
  transformationType: z.string(),
  confidencePropagationRule: z.string(),
});
