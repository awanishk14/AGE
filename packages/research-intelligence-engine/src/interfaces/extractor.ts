import type { NormalizedDocument } from '../normalizers/normalized-document';
import type { ExtractedSignal } from '../signals/extracted-signal';

/** Extractor — pulls signals out of a normalized document. Interface only. */
export interface Extractor {
  extract(document: NormalizedDocument): readonly ExtractedSignal[];
}
