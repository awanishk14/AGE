import { ValueObject } from '../value-object';

/** Props for the Money value object. Placeholder shape. */
export interface MoneyProps {
  readonly value: string;
}

/**
 * Money — shared value object. Placeholder; validation/logic added later.
 */
export class Money extends ValueObject<MoneyProps> {}
