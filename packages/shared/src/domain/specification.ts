/**
 * Specification — base abstraction for composable business rules.
 *
 * Base abstraction only. No rules are implemented here.
 */
export interface Specification<T> {
  isSatisfiedBy(candidate: T): boolean;
}
