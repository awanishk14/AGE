import { ValueObject } from '../value-object';

/** Props for the Phone value object. Placeholder shape. */
export interface PhoneProps {
  readonly value: string;
}

/**
 * Phone — shared value object. Placeholder; validation/logic added later.
 */
export class Phone extends ValueObject<PhoneProps> {}
