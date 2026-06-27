import { ValueObject } from '../value-object';

/** Props for the URL value object. Placeholder shape. */
export interface URLProps {
  readonly value: string;
}

/**
 * URL — shared value object. Placeholder; validation/logic added later.
 */
export class URL extends ValueObject<URLProps> {}
