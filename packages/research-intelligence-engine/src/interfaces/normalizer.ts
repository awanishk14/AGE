import type { RawData } from '../types/common';
import type { NormalizedDocument } from '../normalizers/normalized-document';

/** Normalizer — turns raw source data into NormalizedDocuments. Interface only. */
export interface Normalizer {
  normalize(raw: RawData): readonly NormalizedDocument[];
}
