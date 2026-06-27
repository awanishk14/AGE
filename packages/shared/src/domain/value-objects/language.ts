import { ValueObject } from '../value-object';

/** Props for the Language value object. Placeholder shape. */
export interface LanguageProps {
  readonly value: string;
}

/**
 * Language — shared value object. Placeholder; validation/logic added later.
 */
export class Language extends ValueObject<LanguageProps> {}
