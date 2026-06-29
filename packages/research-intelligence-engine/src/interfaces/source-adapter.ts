import type { RawData } from '../types/common';
import type { NormalizedDocument } from '../normalizers/normalized-document';

/**
 * SourceAdapter — fetches raw data from a source and normalizes it.
 * Interface only; no scraping implementation.
 */
export interface SourceAdapter {
  fetch(query: string): Promise<readonly RawData[]>;
  normalize(raw: readonly RawData[]): readonly NormalizedDocument[];
}
