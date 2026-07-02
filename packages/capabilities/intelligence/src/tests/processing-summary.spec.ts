import { describe, expect, it } from 'vitest';
import type {
  DuplicateEvidenceReference,
  ProcessingSummary,
  RejectedEvidenceReason,
  RejectedEvidenceReasonCode,
} from '../processing-summary';

describe('ProcessingSummary contracts (ADR-0011)', () => {
  it('constrains RejectedEvidenceReasonCode to the known set of codes', () => {
    const codes: RejectedEvidenceReasonCode[] = [
      'MISSING_ID',
      'EMPTY_SOURCE_URL',
      'INVALID_CONFIDENCE',
      'UNRECOGNIZED_STATE',
      'RAW_CONTENT_TOO_SHORT',
      'MISSING_TIMESTAMP',
    ];

    expect(codes).toHaveLength(6);
  });

  it('allows constructing a well-formed RejectedEvidenceReason', () => {
    const reason: RejectedEvidenceReason = {
      evidenceId: 'evidence-1',
      reasonCode: 'MISSING_ID',
      detail: 'Evidence record has no id.',
    };

    expect(reason.reasonCode).toBe('MISSING_ID');
  });

  it('allows constructing a well-formed DuplicateEvidenceReference', () => {
    const duplicate: DuplicateEvidenceReference = {
      evidenceId: 'evidence-2',
      duplicateOfEvidenceId: 'evidence-1',
    };

    expect(duplicate.duplicateOfEvidenceId).toBe('evidence-1');
  });

  it('allows constructing a well-formed ProcessingSummary satisfying the accounting shape', () => {
    const summary: ProcessingSummary = {
      acceptedCount: 1,
      rejectedCount: 1,
      duplicateCount: 1,
      contradictionCount: 0,
      rejectedReasons: [
        { evidenceId: 'evidence-2', reasonCode: 'EMPTY_SOURCE_URL', detail: 'No sourceUrl.' },
      ],
      duplicateReferences: [{ evidenceId: 'evidence-3', duplicateOfEvidenceId: 'evidence-1' }],
    };

    const totalProcessed = summary.acceptedCount + summary.rejectedCount + summary.duplicateCount;
    expect(totalProcessed).toBe(3);
    expect(summary.rejectedReasons).toHaveLength(summary.rejectedCount);
    expect(summary.duplicateReferences).toHaveLength(summary.duplicateCount);
  });
});
