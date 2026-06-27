import { ValueObject } from '../value-object';

/** Props for the Currency value object. Placeholder shape. */
export interface CurrencyProps {
  readonly value: string;
}

/**
 * Currency — shared value object. Placeholder; validation/logic added later.
 */
export class Currency extends ValueObject<CurrencyProps> {}
