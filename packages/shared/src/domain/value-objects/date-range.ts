import { ValueObject } from '../value-object';

/** Props for the DateRange value object. Placeholder shape. */
export interface DateRangeProps {
  readonly value: string;
}

/**
 * DateRange — shared value object. Placeholder; validation/logic added later.
 */
export class DateRange extends ValueObject<DateRangeProps> {}
