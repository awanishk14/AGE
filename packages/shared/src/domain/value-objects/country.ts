import { ValueObject } from '../value-object';

/** Props for the Country value object. Placeholder shape. */
export interface CountryProps {
  readonly value: string;
}

/**
 * Country — shared value object. Placeholder; validation/logic added later.
 */
export class Country extends ValueObject<CountryProps> {}
