import { describe, expect, it } from 'vitest';
import { Capability, ClientContext, ExecutionDomain } from '@age/capability-kit';
import type { MarketDiscoveryInput, MarketSignal } from '@age/market-discovery-contracts';
import { processMarketDiscovery } from '../../processing/process-market-discovery';
import type { MarketDiscoveryResult } from '../../market-discovery-result';

const RUN_AT = '2026-07-10T00:00:00.000Z';
const context = new ClientContext('client-1', 'org-1');

/**
 * A deterministic view of a MarketDiscoveryResult that excludes CapabilityOutput's
 * wall-clock `producedAt` (set via `new Date()` in the CapabilityOutput
 * constructor). Repeated-run equivalence must be asserted on this view, never on
 * the full result object.
 */
function deterministicResultView(result: MarketDiscoveryResult) {
  return {
    output: {
      clientId: result.output.clientId,
      organizationId: result.output.organizationId,
      capability: result.output.capability,
      executionDomains: result.output.executionDomains,
      items: result.output.items,
    },
    summary: result.summary,
  };
}

function buildSignal(overrides: Partial<MarketSignal> = {}): MarketSignal {
  return {
    id: 'signal-1',
    type: 'KEYWORD_GAP',
    target: { kind: 'KEYWORD', key: 'crm software' },
    executionDomains: [ExecutionDomain.SEO],
    strength: 80,
    confidence: 70,
    demandVolume: 500,
    observedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function buildInput(
  signals: readonly MarketSignal[],
  overrides: Partial<MarketDiscoveryInput> = {},
): MarketDiscoveryInput {
  return {
    clientId: 'input-client',
    organizationId: 'input-org',
    signals,
    generatedAt: RUN_AT,
    ...overrides,
  };
}

describe('processMarketDiscovery', () => {
  it('returns empty output and a zeroed summary for empty input', () => {
    const result = processMarketDiscovery(context, buildInput([]));

    expect(result.output.items).toEqual([]);
    expect(result.output.executionDomains).toEqual([]);
    expect(result.summary).toEqual({
      acceptedCount: 0,
      rejectedCount: 0,
      duplicateCount: 0,
      rejectedReasons: [],
      duplicateReferences: [],
    });
  });

  it('produces one item per accepted candidate with the correct mapping', () => {
    const result = processMarketDiscovery(context, buildInput([buildSignal({ id: 'sig-1' })]));

    expect(result.output.items).toHaveLength(1);
    const [item] = result.output.items;
    expect(item?.id).toBe('sig-1');
    expect(item?.opportunityId).toBe('sig-1');
    expect(item?.capability).toBe(Capability.MarketDiscovery);
    expect(item?.opportunityType).toBe('VISIBILITY');
    expect(item?.target).toEqual({ kind: 'KEYWORD', key: 'crm software' });
    expect(item?.executionDomains).toEqual([ExecutionDomain.SEO]);
    // strength 80, demand 500 (norm 50), confidence 70 -> impact round(40+15+14)=69
    // priorityScore round(0.7*69 + 0.3*70) = round(69.3) = 69 -> MEDIUM
    expect(item?.impactScore).toBe(69);
    expect(item?.priority).toBe('MEDIUM');
    expect(item?.createdAt).toEqual(new Date(RUN_AT));
    expect(item?.sourceRefs).toEqual([{ signalId: 'sig-1', signalType: 'KEYWORD_GAP' }]);
  });

  describe('with a mixed valid / invalid / duplicate batch', () => {
    const valid = buildSignal({ id: 'valid-1', target: { kind: 'KEYWORD', key: 'crm software' } });
    const invalid = buildSignal({ id: 'invalid-1', confidence: 999 }); // INVALID_CONFIDENCE
    const duplicateOfValid = buildSignal({
      id: 'dup-1',
      target: { kind: 'KEYWORD', key: 'crm software' },
    }); // same type+target+domains as valid-1
    const distinct = buildSignal({
      id: 'distinct-1',
      type: 'CONTENT_GAP',
      target: { kind: 'TOPIC', key: 'onboarding' },
      executionDomains: [ExecutionDomain.Content],
    });

    const input = buildInput([valid, invalid, duplicateOfValid, distinct]);
    const result = processMarketDiscovery(context, input);
    const outputIds = result.output.items.map((item) => item.opportunityId);

    it('excludes rejected candidates from output.items', () => {
      expect(outputIds).not.toContain('invalid-1');
    });

    it('excludes duplicate candidates from output.items', () => {
      expect(outputIds).not.toContain('dup-1');
    });

    it('records the rejection reason exactly once with a constrained code', () => {
      expect(result.summary.rejectedReasons).toEqual([
        {
          opportunityId: 'invalid-1',
          reasonCode: 'INVALID_CONFIDENCE',
          detail: expect.any(String),
        },
      ]);
    });

    it('records the duplicate reference exactly once, pointing at the first-seen original', () => {
      expect(result.summary.duplicateReferences).toEqual([
        { opportunityId: 'dup-1', duplicateOfOpportunityId: 'valid-1' },
      ]);
    });

    it('merges the duplicate source refs into the accepted original item', () => {
      const validItem = result.output.items.find((item) => item.opportunityId === 'valid-1');
      expect(validItem?.sourceRefs).toEqual([
        { signalId: 'valid-1', signalType: 'KEYWORD_GAP' },
        { signalId: 'dup-1', signalType: 'KEYWORD_GAP' },
      ]);
    });

    it('satisfies the ADR-0013 accounting invariants', () => {
      const { acceptedCount, rejectedCount, duplicateCount } = result.summary;
      const derivedCount = input.signals.length; // 1 signal -> 1 candidate

      expect(acceptedCount + rejectedCount + duplicateCount).toBe(derivedCount);
      expect(result.summary.rejectedReasons).toHaveLength(rejectedCount);
      expect(result.summary.duplicateReferences).toHaveLength(duplicateCount);
      expect(result.output.items).toHaveLength(acceptedCount);
      expect(acceptedCount).toBe(2); // valid-1 (+merged dup-1) and distinct-1
    });

    it('lists each rejected and duplicate id exactly once and never in output', () => {
      const rejectedIds = result.summary.rejectedReasons.map((r) => r.opportunityId);
      const duplicateIds = result.summary.duplicateReferences.map((d) => d.opportunityId);
      expect(new Set(rejectedIds).size).toBe(rejectedIds.length);
      expect(new Set(duplicateIds).size).toBe(duplicateIds.length);
      for (const id of [...rejectedIds, ...duplicateIds]) {
        expect(outputIds).not.toContain(id);
      }
    });
  });

  it('scopes the output by ClientContext, not by the input', () => {
    const authoritative = new ClientContext('authoritative-client', 'authoritative-org');
    const result = processMarketDiscovery(
      authoritative,
      buildInput([buildSignal()], { clientId: 'input-client', organizationId: 'input-org' }),
    );

    expect(result.output.clientId).toBe('authoritative-client');
    expect(result.output.organizationId).toBe('authoritative-org');
    expect(result.output.clientId).not.toBe('input-client');
  });

  it('uses input.generatedAt for every item createdAt deterministically', () => {
    const result = processMarketDiscovery(
      context,
      buildInput([
        buildSignal({ id: 's1' }),
        buildSignal({ id: 's2', target: { kind: 'TOPIC', key: 't' } }),
      ]),
    );
    for (const item of result.output.items) {
      expect(item.createdAt).toEqual(new Date(RUN_AT));
    }
  });

  it('derives the output envelope executionDomains from accepted items only, deduplicated and sorted', () => {
    const result = processMarketDiscovery(
      context,
      buildInput([
        buildSignal({
          id: 's1',
          target: { kind: 'KEYWORD', key: 'a' },
          executionDomains: [ExecutionDomain.SEO],
        }),
        buildSignal({
          id: 's2',
          target: { kind: 'KEYWORD', key: 'b' },
          executionDomains: [ExecutionDomain.Content, ExecutionDomain.SEO],
        }),
      ]),
    );
    expect(result.output.executionDomains).toEqual(
      [ExecutionDomain.Content, ExecutionDomain.SEO].sort(),
    );
  });

  it('returns an equivalent result on repeated runs with the same input', () => {
    const input = buildInput([
      buildSignal({ id: 's1' }),
      buildSignal({ id: 's2', target: { kind: 'TOPIC', key: 'onboarding' } }),
    ]);
    expect(deterministicResultView(processMarketDiscovery(context, input))).toEqual(
      deterministicResultView(processMarketDiscovery(context, input)),
    );
  });
});
