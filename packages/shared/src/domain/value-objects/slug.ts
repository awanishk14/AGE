import { ValueObject } from '../value-object';

/** Props for the Slug value object. Placeholder shape. */
export interface SlugProps {
  readonly value: string;
}

/**
 * Slug — shared value object. Placeholder; validation/logic added later.
 */
export class Slug extends ValueObject<SlugProps> {}
