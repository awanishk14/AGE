/**
 * UniqueId — base abstraction for typed identifiers.
 *
 * Base abstraction only; concrete id types are introduced during implementation.
 */
export abstract class UniqueId {
  abstract get value(): string;
  abstract equals(other?: UniqueId): boolean;
}
