import { ValueObject } from '../value-object';

/** Props for the Email value object. Placeholder shape. */
export interface EmailProps {
  readonly value: string;
}

/**
 * Email — shared value object. Placeholder; validation/logic added later.
 */
export class Email extends ValueObject<EmailProps> {}
