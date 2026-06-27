import type { NormalizedDocument } from '../normalizers/normalized-document';
import type { ExtractedSignal } from '../signals/extracted-signal';
import type { Evidence } from '../evidence/evidence';

/**
 * SignalEngine — assembles a document and its signals into Evidence.
 * Interface only; no logic.
 */
export interface SignalEngine {
  assemble(document: NormalizedDocument, signals: readonly ExtractedSignal[]): Evidence;
}
