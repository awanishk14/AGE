/**
 * AuthorityPlanSourceRef — provenance tying a derived authority plan back to the
 * originating upstream reference. Carries both the reference id and its type,
 * so provenance remains meaningful once structural duplicates are merged into a
 * single accepted plan (Authority may consume references to different upstream
 * concepts). Data contract only.
 */
export interface AuthorityPlanSourceRef {
  readonly referenceId: string;
  readonly referenceType: string;
}
