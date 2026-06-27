/**
 * Clock — base abstraction over the current time (for testability).
 *
 * Base abstraction only. No implementation.
 */
export interface Clock {
  now(): Date;
}
