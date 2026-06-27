/**
 * DomainError — base class for domain-specific errors.
 *
 * Base abstraction only. Concrete errors extend this with a stable `code`.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
