/**
 * ValueObject — base class for immutable, equality-by-value objects.
 *
 * Base abstraction only. Concrete value objects live in `domain/value-objects`.
 */
export abstract class ValueObject<TProps> {
  protected constructor(protected readonly props: TProps) {}

  equals(other?: ValueObject<TProps>): boolean {
    if (other === undefined) {
      return false;
    }
    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }
}
