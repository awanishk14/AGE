import { describe, expect, it } from 'vitest';
import { Capability, ExecutionDomain } from '../enums';
import { CapabilityOutput } from '../outputs/capability-output';
import type { CapabilityOutputItem } from '../outputs/capability-output-item';
import type { CapabilityResult, ProcessingSummary } from '../outputs/processing-summary';

interface TestItem extends CapabilityOutputItem {
  title: string;
}

// A capability-specific rejected-reason / duplicate-reference pair, mirroring how
// real capabilities keep their own id fields and reason-code unions (ADR-0016).
type TestReasonCode = 'MISSING_ID' | 'INVALID_VALUE';

interface TestRejectedReason {
  readonly entityId: string;
  readonly reasonCode: TestReasonCode;
  readonly detail: string;
}

interface TestDuplicateReference {
  readonly entityId: string;
  readonly duplicateOfEntityId: string;
}

type TestSummary = ProcessingSummary<TestRejectedReason, TestDuplicateReference>;

describe('ProcessingSummary (shared, ADR-0016)', () => {
  it('is generic over the capability-specific reason/reference types', () => {
    const summary: TestSummary = {
      acceptedCount: 1,
      rejectedCount: 1,
      duplicateCount: 1,
      rejectedReasons: [{ entityId: 'e-2', reasonCode: 'MISSING_ID', detail: 'no id' }],
      duplicateReferences: [{ entityId: 'e-3', duplicateOfEntityId: 'e-1' }],
    };

    // The reason/reference id fields are whatever the capability declares.
    expect(summary.rejectedReasons[0]!.entityId).toBe('e-2');
    expect(summary.rejectedReasons[0]!.reasonCode).toBe('MISSING_ID');
    expect(summary.duplicateReferences[0]!.duplicateOfEntityId).toBe('e-1');
  });

  it('supports the ADR-0016 accounting-invariant shape', () => {
    const summary: TestSummary = {
      acceptedCount: 2,
      rejectedCount: 1,
      duplicateCount: 1,
      rejectedReasons: [{ entityId: 'e-2', reasonCode: 'INVALID_VALUE', detail: 'bad' }],
      duplicateReferences: [{ entityId: 'e-3', duplicateOfEntityId: 'e-1' }],
    };

    const total = summary.acceptedCount + summary.rejectedCount + summary.duplicateCount;
    expect(total).toBe(4);
    expect(summary.rejectedReasons).toHaveLength(summary.rejectedCount);
    expect(summary.duplicateReferences).toHaveLength(summary.duplicateCount);
  });

  it('allows a capability-specific extension (e.g. Intelligence contradictionCount)', () => {
    type ExtendedSummary = TestSummary & { readonly contradictionCount: number };
    const summary: ExtendedSummary = {
      acceptedCount: 0,
      rejectedCount: 0,
      duplicateCount: 0,
      rejectedReasons: [],
      duplicateReferences: [],
      contradictionCount: 3,
    };
    expect(summary.contradictionCount).toBe(3);
  });
});

describe('CapabilityResult (shared, ADR-0016)', () => {
  it('pairs an unmodified CapabilityOutput with a capability-specific summary', () => {
    const output = new CapabilityOutput<TestItem>({
      clientId: 'client-1',
      organizationId: 'org-1',
      capability: Capability.Intelligence,
      executionDomains: [ExecutionDomain.SEO],
      items: [],
    });
    const summary: TestSummary = {
      acceptedCount: 0,
      rejectedCount: 0,
      duplicateCount: 0,
      rejectedReasons: [],
      duplicateReferences: [],
    };
    const result: CapabilityResult<TestItem, TestSummary> = { output, summary };

    expect(result.output).toBe(output);
    expect(result.output.capability).toBe(Capability.Intelligence);
    expect(result.summary.acceptedCount).toBe(0);
  });
});
