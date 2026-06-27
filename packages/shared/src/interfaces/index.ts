/** Standard result envelope shared across AGE. Placeholder. */
export interface AgeResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}
