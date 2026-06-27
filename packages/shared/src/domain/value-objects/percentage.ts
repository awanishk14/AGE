import { ValueObject } from '../value-object';

/** Props for the Percentage value object. Placeholder shape. */
export interface PercentageProps {
  readonly value: string;
}

/**
 * Percentage — shared value object. Placeholder; validation/logic added later.
 */
export class Percentage extends ValueObject<PercentageProps> {}
