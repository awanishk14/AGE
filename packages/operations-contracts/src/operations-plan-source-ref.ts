/**
 * OperationsPlanSourceRef — a neutral provenance reference tying a derived plan
 * candidate back to its originating input reference(s) (ADR-0018). Plain data
 * only; carries no upstream behavior.
 */
export interface OperationsPlanSourceRef {
  readonly referenceId: string;
  readonly referenceType: string;
}
