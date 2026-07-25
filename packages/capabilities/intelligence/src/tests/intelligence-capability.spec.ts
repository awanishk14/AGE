import { describe, expect, it } from 'vitest';
import { CapabilityRegistry, Capability } from '@age/capability-kit';
import type { EvidencePackage } from '@age/evidence-contracts';
import { INTELLIGENCE_CAPABILITY_ENTRY } from '../intelligence-capability.entry';
import { IntelligenceCapability } from '../intelligence-capability';

function buildEvidencePackage(overrides: Partial<EvidencePackage> = {}): EvidencePackage {
  return {
    clientId: 'client-1',
    organizationId: 'org-1',
    evidence: [],
    generatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('IntelligenceCapability entry', () => {
  it('has the correct capability name', () => {
    expect(INTELLIGENCE_CAPABILITY_ENTRY.name).toBe(Capability.Intelligence);
  });

  it('declares what it consumes and produces', () => {
    expect(INTELLIGENCE_CAPABILITY_ENTRY.consumes).toContain('RIEEvidencePackage');
    expect(INTELLIGENCE_CAPABILITY_ENTRY.produces).toContain('ValidatedEvidenceSet');
  });

  it('advertises assessed context via assessesContext, never via consumes (ADR-0028)', () => {
    expect(INTELLIGENCE_CAPABILITY_ENTRY.assessesContext).toEqual(['ScoredBifContext']);
    // `consumes` is `run`'s required inputs only; ScoredBifContext is optional
    // and never seen by `run`, so it must not appear there.
    expect(INTELLIGENCE_CAPABILITY_ENTRY.consumes).not.toContain('ScoredBifContext');
  });

  it('can be registered in the CapabilityRegistry without error', () => {
    const registry = new CapabilityRegistry();
    expect(() => registry.register(INTELLIGENCE_CAPABILITY_ENTRY)).not.toThrow();
    expect(registry.resolve(Capability.Intelligence).name).toBe(Capability.Intelligence);
  });
});

describe('IntelligenceCapability', () => {
  it('is instantiable', () => {
    expect(() => new IntelligenceCapability()).not.toThrow();
  });

  it('run() returns an IntelligenceResult for the given context and evidence package', async () => {
    const capability = new IntelligenceCapability();
    const { ClientContext } = await import('@age/capability-kit');
    const ctx = new ClientContext('client-1', 'org-1');
    const result = await capability.run(ctx, buildEvidencePackage());

    expect(result.output.capability).toBe(Capability.Intelligence);
    expect(result.output.clientId).toBe('client-1');
    expect(result.output.items).toBeInstanceOf(Array);

    expect(result.summary.acceptedCount).toBe(0);
    expect(result.summary.rejectedCount).toBe(0);
    expect(result.summary.duplicateCount).toBe(0);
    expect(result.summary.contradictionCount).toBe(0);
    expect(result.summary.rejectedReasons).toEqual([]);
    expect(result.summary.duplicateReferences).toEqual([]);
  });
});
