import { ValueObject } from '../value-object';

/** Props for the Timezone value object. Placeholder shape. */
export interface TimezoneProps {
  readonly value: string;
}

/**
 * Timezone — shared value object. Placeholder; validation/logic added later.
 */
export class Timezone extends ValueObject<TimezoneProps> {}
