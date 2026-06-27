/**
 * Database configuration surface for the persistence layer.
 * Architecture only; connection management is implemented later.
 */
export interface DatabaseConfig {
  readonly url: string;
}
