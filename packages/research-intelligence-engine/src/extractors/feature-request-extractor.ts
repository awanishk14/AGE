import type { Extractor } from '../interfaces/extractor';
import type { NormalizedDocument } from '../normalizers/normalized-document';
import type { ExtractedSignal } from '../signals/extracted-signal';

/**
 * FeatureRequestExtractor — placeholder. Implements the Extractor contract but performs no
 * extraction or inference yet; returns no signals.
 */
export class FeatureRequestExtractor implements Extractor {
  extract(_document: NormalizedDocument): readonly ExtractedSignal[] {
    return [];
  }
}
