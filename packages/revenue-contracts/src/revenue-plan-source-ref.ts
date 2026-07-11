/**
 * RevenuePlanSourceRef — a neutral provenance reference tying a derived plan
 * candidate back to its originating input reference(s) (ADR-0019). Plain data
 * only; carries no upstream behavior.
 */
export interface RevenuePlanSourceRef {
  readonly referenceId: string;
  readonly referenceType: string;
}
