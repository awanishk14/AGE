import { describe, expect, it } from 'vitest';
import { ExecutionDomain } from '@age/capability-kit';
import { scoreOpportunity } from '../../processing/score-opportunity';
import type { MarketOpportunityCandidate } from '../../processing/market-opportunity-candidate';

function buildCandidate(
  overrides: Partial<MarketOpportunityCandidate> = {},
): MarketOpportunityCandidate {
  return {
    opportunityId: 'opp-1',
    opportunityType: 'VISIBILITY',
    target: { kind: 'KEYWORD', key: 'crm software' },
    executionDomains: [ExecutionDomain.SEO],
    strength: 0,
    confidence: 0,
    demandVolume: 0,
    sourceRefs: [{ signalId: 'signal-1', signalType: 'KEYWORD_GAP' }],
    ...overrides,
  };
}

describe('scoreOpportunity', () => {
  it('returns the minimum boundary for zero inputs', () => {
    const score = scoreOpportunity(buildCandidate({ strength: 0, confidence: 0, demandVolume: 0 }));
    expect(score).toEqual({ impactScore: 0, confidenceScore: 0, priority: 'LOW' });
  });

  it('returns the maximum boundary for saturated inputs', () => {
    const score = scoreOpportunity(
      buildCandidate({ strength: 100, confidence: 100, demandVolume: 1000 }),
    );
    expect(score).toEqual({ impactScore: 100, confidenceScore: 100, priority: 'HIGH' });
  });

  it('computes the mid case deterministically', () => {
    const score = scoreOpportunity(
      buildCandidate({ strength: 50, confidence: 50, demandVolume: 500 }),
    );
    // normalizedDemand = 50; impact = round(25 + 15 + 10) = 50; priorityScore = round(35 + 15) = 50
    expect(score).toEqual({ impactScore: 50, confidenceScore: 50, priority: 'MEDIUM' });
  });

  it('weights the impact formula 0.50/0.30/0.20 (strength/demand/confidence)', () => {
    expect(scoreOpportunity(buildCandidate({ strength: 100 })).impactScore).toBe(50);
    expect(scoreOpportunity(buildCandidate({ demandVolume: 1000 })).impactScore).toBe(30);
    expect(scoreOpportunity(buildCandidate({ confidence: 100 })).impactScore).toBe(20);
  });

  it('caps demandVolume at DEMAND_CAP (1000)', () => {
    const atCap = scoreOpportunity(buildCandidate({ demandVolume: 1000 })).impactScore;
    const overCap = scoreOpportunity(buildCandidate({ demandVolume: 100_000 })).impactScore;
    expect(atCap).toBe(30);
    expect(overCap).toBe(30);
  });

  it('maps priorityScore >= 70 to HIGH', () => {
    // strength 100, demand 1000, confidence 100 -> impact 100 -> priorityScore 100
    expect(
      scoreOpportunity(buildCandidate({ strength: 100, demandVolume: 1000, confidence: 100 }))
        .priority,
    ).toBe('HIGH');
  });

  it('maps priorityScore in [40,70) to MEDIUM', () => {
    // strength 50, demand 500, confidence 50 -> priorityScore 50
    expect(
      scoreOpportunity(buildCandidate({ strength: 50, demandVolume: 500, confidence: 50 }))
        .priority,
    ).toBe('MEDIUM');
  });

  it('maps priorityScore < 40 to LOW', () => {
    // strength 20, demand 0, confidence 0 -> impact 10 -> priorityScore 7
    expect(
      scoreOpportunity(buildCandidate({ strength: 20, demandVolume: 0, confidence: 0 })).priority,
    ).toBe('LOW');
  });

  it('never returns a score outside [0, 100]', () => {
    const score = scoreOpportunity(
      buildCandidate({ strength: 100, confidence: 100, demandVolume: 100_000 }),
    );
    expect(score.impactScore).toBeGreaterThanOrEqual(0);
    expect(score.impactScore).toBeLessThanOrEqual(100);
    expect(score.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(score.confidenceScore).toBeLessThanOrEqual(100);
  });

  it('is deterministic for the same input', () => {
    const candidate = buildCandidate({ strength: 63, confidence: 41, demandVolume: 777 });
    expect(scoreOpportunity(candidate)).toEqual(scoreOpportunity(candidate));
  });
});
