import { ValueObject } from '../value-object';

/** Props for the GeoLocation value object. Placeholder shape. */
export interface GeoLocationProps {
  readonly value: string;
}

/**
 * GeoLocation — shared value object. Placeholder; validation/logic added later.
 */
export class GeoLocation extends ValueObject<GeoLocationProps> {}
