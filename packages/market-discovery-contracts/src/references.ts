/**
 * BifFieldReference — a neutral, read-only mirror of BIF's field address
 * (ADR-0012). Intentionally small: only the address components Market Discovery
 * reads for provenance. NOT a copy of the BIF domain model, and NOT imported
 * from `@age/bif` — keeping the capability free of a BIF dependency.
 *
 * `section` is a plain string (not BIF's SectionType enum) precisely to avoid
 * importing BIF. No resolution or lookup logic lives here — reference only.
 */
export interface BifFieldReference {
  readonly section: string;
  readonly fieldKey: string;
  readonly path: string;
}
