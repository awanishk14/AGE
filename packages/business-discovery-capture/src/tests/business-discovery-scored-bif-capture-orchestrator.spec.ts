import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  InMemoryScoredBifSnapshotRepository,
  SAMPLE_BUSINESS_DISCOVERY_PROFILE,
  produceScoredBifContext,
} from '@age/business-discovery-contracts';
import type { ScoredBifSnapshotRepository } from '@age/business-discovery-contracts';
import { ClientContext } from '@age/capability-kit';
import { ScoredBifSnapshotCaptureOrchestrator } from '@age/scored-bif-snapshot-persistence';

import {
  BusinessDiscoveryScoredBifCaptureOrchestrator,
  type BusinessDiscoveryCaptureMapping,
} from '../business-discovery-scored-bif-capture-orchestrator';

/**
 * ADR-0040 — the use case that joins canonical Path B production to scored BIF
 * snapshot capture.
 *
 * These tests exist to pin the properties that make the join safe: that scope
 * has exactly one source, that nothing is invented, that capture happens only
 * when asked and exactly once, and that a failed write is reported rather than
 * hidden or thrown.
 */

const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const USE_CASE_SOURCE = readFileSync(
  join(MODULE_DIRECTORY, '..', 'business-discovery-scored-bif-capture-orchestrator.ts'),
  'utf8',
);

/** Doc comments legitimately name things the executable code must not do. */
function withoutComments(source: string): string {
  return source.replace(/\/\*\*[\s\S]*?\*\/|\/\/.*$/gm, '');
}

const CLIENT_CONTEXT = new ClientContext('client-alpha', 'organization-alpha');

const MAPPING: BusinessDiscoveryCaptureMapping = {
  constructedAt: new Date('2026-01-01T00:00:00.000Z'),
  changedBy: 'capture-use-case-operator',
};

const CAPTURED_AT = '2026-01-02T00:00:00.000Z';

/** A repository that counts appends, so "exactly once" is measurable. */
class CountingRepository implements ScoredBifSnapshotRepository {
  appendCount = 0;
  private readonly inner = new InMemoryScoredBifSnapshotRepository();

  async append(...args: Parameters<ScoredBifSnapshotRepository['append']>): Promise<void> {
    this.appendCount += 1;
    await this.inner.append(...args);
  }

  findBySnapshotId(
    ...args: Parameters<ScoredBifSnapshotRepository['findBySnapshotId']>
  ): ReturnType<ScoredBifSnapshotRepository['findBySnapshotId']> {
    return this.inner.findBySnapshotId(...args);
  }

  listSeries(
    ...args: Parameters<ScoredBifSnapshotRepository['listSeries']>
  ): ReturnType<ScoredBifSnapshotRepository['listSeries']> {
    return this.inner.listSeries(...args);
  }

  findLatest(
    ...args: Parameters<ScoredBifSnapshotRepository['findLatest']>
  ): ReturnType<ScoredBifSnapshotRepository['findLatest']> {
    return this.inner.findLatest(...args);
  }
}

/** A repository whose write always fails, with a distinguishable error. */
class FailingRepository implements ScoredBifSnapshotRepository {
  static readonly MESSAGE = 'database unavailable';
  private readonly inner = new InMemoryScoredBifSnapshotRepository();

  async append(): Promise<void> {
    throw new Error(FailingRepository.MESSAGE);
  }

  findBySnapshotId(
    ...args: Parameters<ScoredBifSnapshotRepository['findBySnapshotId']>
  ): ReturnType<ScoredBifSnapshotRepository['findBySnapshotId']> {
    return this.inner.findBySnapshotId(...args);
  }

  listSeries(
    ...args: Parameters<ScoredBifSnapshotRepository['listSeries']>
  ): ReturnType<ScoredBifSnapshotRepository['listSeries']> {
    return this.inner.listSeries(...args);
  }

  findLatest(
    ...args: Parameters<ScoredBifSnapshotRepository['findLatest']>
  ): ReturnType<ScoredBifSnapshotRepository['findLatest']> {
    return this.inner.findLatest(...args);
  }
}

describe('BusinessDiscoveryScoredBifCaptureOrchestrator — production', () => {
  it('produces its context through canonical Path B, adding no mapping of its own', async () => {
    const useCase = new BusinessDiscoveryScoredBifCaptureOrchestrator();

    const result = await useCase.execute({
      mode: 'produceOnly',
      clientContext: CLIENT_CONTEXT,
      profile: SAMPLE_BUSINESS_DISCOVERY_PROFILE,
      mapping: MAPPING,
    });

    const expected = produceScoredBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE, {
      organizationId: CLIENT_CONTEXT.organizationId,
      constructedAt: MAPPING.constructedAt,
      changedBy: MAPPING.changedBy,
    });

    expect(result.context).toEqual(expected.context);
    expect(result.mappingMetadata).toEqual(expected.mappingMetadata);
    expect(result.scoringMetadata).toEqual(expected.scoringMetadata);
    // It calls the canonical producer by name; it does not re-chain the steps.
    expect(withoutComments(USE_CASE_SOURCE)).toMatch(/produceScoredBifContext\(/);
    expect(withoutComments(USE_CASE_SOURCE)).not.toMatch(/mapBusinessDiscoveryToBifDraft/);
    expect(withoutComments(USE_CASE_SOURCE)).not.toMatch(/scoreBusinessIntelligenceFramework/);
    expect(withoutComments(USE_CASE_SOURCE)).not.toMatch(/projectScoredBifContext/);
  });

  it('never promotes the BIF — the projection stays Draft', async () => {
    const useCase = new BusinessDiscoveryScoredBifCaptureOrchestrator();

    const result = await useCase.execute({
      mode: 'produceOnly',
      clientContext: CLIENT_CONTEXT,
      profile: SAMPLE_BUSINESS_DISCOVERY_PROFILE,
      mapping: MAPPING,
    });

    expect(result.context.bifStatus).toBe('Draft');
    expect(withoutComments(USE_CASE_SOURCE)).not.toMatch(/Active/);
  });

  it('lets mapper failures stay visible as throws rather than degraded results', async () => {
    const useCase = new BusinessDiscoveryScoredBifCaptureOrchestrator();

    await expect(
      useCase.execute({
        mode: 'produceOnly',
        clientContext: CLIENT_CONTEXT,
        // A profile the mapper's own guard rejects.
        profile: { not: 'a profile' } as never,
        mapping: MAPPING,
      }),
    ).rejects.toThrow();
  });
});

describe('BusinessDiscoveryScoredBifCaptureOrchestrator — scope has one source', () => {
  it('passes the ClientContext through as the scope source for capture', async () => {
    const repository = new InMemoryScoredBifSnapshotRepository();
    const useCase = new BusinessDiscoveryScoredBifCaptureOrchestrator(
      new ScoredBifSnapshotCaptureOrchestrator(repository),
    );

    const result = await useCase.execute({
      mode: 'produceAndCapture',
      clientContext: CLIENT_CONTEXT,
      profile: SAMPLE_BUSINESS_DISCOVERY_PROFILE,
      mapping: MAPPING,
      snapshotId: 'snapshot-1',
      capturedAt: CAPTURED_AT,
    });

    expect(result.capture.kind).toBe('captured');

    // The snapshot is readable under exactly the ClientContext's ids...
    const stored = await repository.findBySnapshotId({
      clientId: CLIENT_CONTEXT.clientId,
      organizationId: CLIENT_CONTEXT.organizationId,
      bifId: result.context.bifId,
      snapshotId: 'snapshot-1',
    });
    expect(stored).not.toBeNull();

    // ...and under no other client.
    const foreign = await repository.findBySnapshotId({
      clientId: 'client-beta',
      organizationId: CLIENT_CONTEXT.organizationId,
      bifId: result.context.bifId,
      snapshotId: 'snapshot-1',
    });
    expect(foreign).toBeNull();
  });

  it('uses the ClientContext organization for the BIF too, so the two cannot disagree', async () => {
    const useCase = new BusinessDiscoveryScoredBifCaptureOrchestrator();

    const result = await useCase.execute({
      mode: 'produceOnly',
      clientContext: new ClientContext('client-beta', 'organization-beta'),
      profile: SAMPLE_BUSINESS_DISCOVERY_PROFILE,
      mapping: MAPPING,
    });

    // The projection carries NO organizationId — ADR-0030's rule that scope is
    // never read from the payload, holding at the type level (PR #126 finding
    // 1). So there is nothing in the output that could contradict the context.
    expect(result.context).not.toHaveProperty('organizationId');
    expect(result.context.bifStatus).toBe('Draft');
    // The mapper received it, and the executable source shows the ClientContext
    // is the only place it can have come from.
    expect(withoutComments(USE_CASE_SOURCE)).toMatch(
      /organizationId:\s*request\.clientContext\.organizationId/,
    );
  });

  it('rejects a caller-supplied clientId at compile time', () => {
    const useCase = new BusinessDiscoveryScoredBifCaptureOrchestrator();
    const request = {
      mode: 'produceOnly' as const,
      clientContext: CLIENT_CONTEXT,
      profile: SAMPLE_BUSINESS_DISCOVERY_PROFILE,
      mapping: MAPPING,
      clientId: 'client-smuggled',
    };

    // @ts-expect-error `clientId` is `?: never` — scope may only come from ClientContext.
    void useCase.execute(request);
  });

  it('rejects a caller-supplied organizationId at compile time', () => {
    const useCase = new BusinessDiscoveryScoredBifCaptureOrchestrator();
    const request = {
      mode: 'produceOnly' as const,
      clientContext: CLIENT_CONTEXT,
      profile: SAMPLE_BUSINESS_DISCOVERY_PROFILE,
      mapping: MAPPING,
      organizationId: 'organization-smuggled',
    };

    // @ts-expect-error `organizationId` is `?: never` — scope may only come from ClientContext.
    void useCase.execute(request);
  });

  it('rejects an organizationId smuggled through the mapping options', () => {
    const mapping = {
      ...MAPPING,
      organizationId: 'organization-smuggled',
    };

    // @ts-expect-error the mapper's organizationId is `?: never` here (ADR-0040 D6).
    const rejected: BusinessDiscoveryCaptureMapping = mapping;
    void rejected;
  });
});

describe('BusinessDiscoveryScoredBifCaptureOrchestrator — capture is explicit', () => {
  it('performs no persistence side effect in produceOnly mode', async () => {
    const repository = new CountingRepository();
    const useCase = new BusinessDiscoveryScoredBifCaptureOrchestrator(
      new ScoredBifSnapshotCaptureOrchestrator(repository),
    );

    const result = await useCase.execute({
      mode: 'produceOnly',
      clientContext: CLIENT_CONTEXT,
      profile: SAMPLE_BUSINESS_DISCOVERY_PROFILE,
      mapping: MAPPING,
    });

    expect(result.capture).toEqual({ kind: 'not-requested' });
    expect(repository.appendCount).toBe(0);
  });

  it('captures exactly once in produceAndCapture mode', async () => {
    const repository = new CountingRepository();
    const useCase = new BusinessDiscoveryScoredBifCaptureOrchestrator(
      new ScoredBifSnapshotCaptureOrchestrator(repository),
    );

    const result = await useCase.execute({
      mode: 'produceAndCapture',
      clientContext: CLIENT_CONTEXT,
      profile: SAMPLE_BUSINESS_DISCOVERY_PROFILE,
      mapping: MAPPING,
      snapshotId: 'snapshot-1',
      capturedAt: CAPTURED_AT,
    });

    expect(repository.appendCount).toBe(1);
    expect(result.capture).toEqual({
      kind: 'captured',
      receipt: {
        bifId: result.context.bifId,
        snapshotId: 'snapshot-1',
        capturedAt: CAPTURED_AT,
      },
    });
  });

  it('works without a capture dependency at all in produceOnly mode', async () => {
    const useCase = new BusinessDiscoveryScoredBifCaptureOrchestrator();

    const result = await useCase.execute({
      mode: 'produceOnly',
      clientContext: CLIENT_CONTEXT,
      profile: SAMPLE_BUSINESS_DISCOVERY_PROFILE,
      mapping: MAPPING,
    });

    expect(result.capture).toEqual({ kind: 'not-requested' });
  });

  it('throws when capture is requested but no capture dependency was injected', async () => {
    const useCase = new BusinessDiscoveryScoredBifCaptureOrchestrator();

    // A misconfiguration must not masquerade as a database problem (D8).
    await expect(
      useCase.execute({
        mode: 'produceAndCapture',
        clientContext: CLIENT_CONTEXT,
        profile: SAMPLE_BUSINESS_DISCOVERY_PROFILE,
        mapping: MAPPING,
        snapshotId: 'snapshot-1',
        capturedAt: CAPTURED_AT,
      }),
    ).rejects.toThrow(/no ScoredBifSnapshotCaptureOrchestrator was injected/);
  });
});

describe('BusinessDiscoveryScoredBifCaptureOrchestrator — capture failure is explicit', () => {
  it('returns the failure rather than throwing, and keeps the produced context', async () => {
    const useCase = new BusinessDiscoveryScoredBifCaptureOrchestrator(
      new ScoredBifSnapshotCaptureOrchestrator(new FailingRepository()),
    );

    const result = await useCase.execute({
      mode: 'produceAndCapture',
      clientContext: CLIENT_CONTEXT,
      profile: SAMPLE_BUSINESS_DISCOVERY_PROFILE,
      mapping: MAPPING,
      snapshotId: 'snapshot-1',
      capturedAt: CAPTURED_AT,
    });

    expect(result.capture.kind).toBe('failed');
    if (result.capture.kind !== 'failed') throw new Error('unreachable');
    expect(result.capture.error).toBeInstanceOf(Error);
    expect(result.capture.error.message).toBe(FailingRepository.MESSAGE);

    // The context was genuinely produced; a failed write does not destroy it.
    expect(result.context.bifStatus).toBe('Draft');
    expect(result.context.sections.length).toBeGreaterThan(0);
  });

  it('reports a duplicate snapshotId as a failure, not a silent success', async () => {
    const useCase = new BusinessDiscoveryScoredBifCaptureOrchestrator(
      new ScoredBifSnapshotCaptureOrchestrator(new InMemoryScoredBifSnapshotRepository()),
    );

    const request = {
      mode: 'produceAndCapture' as const,
      clientContext: CLIENT_CONTEXT,
      profile: SAMPLE_BUSINESS_DISCOVERY_PROFILE,
      mapping: MAPPING,
      snapshotId: 'snapshot-1',
      capturedAt: CAPTURED_AT,
    };

    expect((await useCase.execute(request)).capture.kind).toBe('captured');
    expect((await useCase.execute(request)).capture.kind).toBe('failed');
  });
});

describe('BusinessDiscoveryScoredBifCaptureOrchestrator — boundaries', () => {
  it('invents nothing: no clock, no id generation, no randomness', () => {
    const executable = withoutComments(USE_CASE_SOURCE);

    expect(executable).not.toMatch(/new Date\(/);
    expect(executable).not.toMatch(/Date\.now\(/);
    expect(executable).not.toMatch(/Math\.random\(/);
    expect(executable).not.toMatch(/randomUUID|crypto\./);
    expect(executable).not.toMatch(/performance\.now\(/);
    expect(executable).not.toMatch(/process\.env/);
  });

  it('takes constructedAt, changedBy, snapshotId and capturedAt from the caller only', async () => {
    const repository = new InMemoryScoredBifSnapshotRepository();
    const useCase = new BusinessDiscoveryScoredBifCaptureOrchestrator(
      new ScoredBifSnapshotCaptureOrchestrator(repository),
    );

    const result = await useCase.execute({
      mode: 'produceAndCapture',
      clientContext: CLIENT_CONTEXT,
      profile: SAMPLE_BUSINESS_DISCOVERY_PROFILE,
      mapping: MAPPING,
      snapshotId: 'snapshot-explicit',
      capturedAt: CAPTURED_AT,
    });

    if (result.capture.kind !== 'captured') throw new Error('expected a capture');
    expect(result.capture.receipt.snapshotId).toBe('snapshot-explicit');
    expect(result.capture.receipt.capturedAt).toBe(CAPTURED_AT);

    // `constructedAt` and `changedBy` are proven at the SOURCE, not by an
    // output assertion. The neutral projection deliberately carries no dates
    // and no audit actor (ADR-0026 D1, ADR-0037's second finding), so an
    // assertion that two runs differ would be vacuous — it would pass just as
    // happily if the use case had defaulted both itself. What is checkable is
    // that the whole caller-supplied mapping is spread into the producer and
    // nothing else supplies either value.
    const executable = withoutComments(USE_CASE_SOURCE);
    expect(executable).toMatch(/produceScoredBifContext\(request\.profile,\s*\{\s*\.\.\.mapping/);
    expect(executable).not.toMatch(/constructedAt:/);
    expect(executable).not.toMatch(/changedBy:/);
    // And they are required of the caller: omitting them fails to compile.
    // @ts-expect-error `constructedAt` and `changedBy` are mandatory mapping inputs.
    const incomplete: BusinessDiscoveryCaptureMapping = {};
    void incomplete;
  });

  it('touches the capture orchestrator only — never the raw port, facade or Prisma', () => {
    const executable = withoutComments(USE_CASE_SOURCE);

    expect(executable).not.toMatch(/ClientContextBoundScoredBifSnapshotRepository/);
    expect(executable).not.toMatch(/ScopedScoredBifSnapshotRepository/);
    expect(executable).not.toMatch(/PrismaScoredBifSnapshotRepository/);
    expect(executable).not.toMatch(/@prisma\/client/);
    expect(executable).not.toMatch(/PrismaClient/);
    expect(executable).toMatch(/ScoredBifSnapshotCaptureOrchestrator/);
  });

  it('declares exactly the three dependencies ADR-0040 D2 sanctioned', () => {
    const manifest: { dependencies: Record<string, string> } = JSON.parse(
      readFileSync(join(MODULE_DIRECTORY, '..', '..', 'package.json'), 'utf8'),
    ) as { dependencies: Record<string, string> };

    expect(Object.keys(manifest.dependencies).sort()).toEqual([
      '@age/business-discovery-contracts',
      '@age/capability-kit',
      '@age/scored-bif-snapshot-persistence',
    ]);
    // `@age/bif` stays transitive-only; this package never names it.
    expect(Object.keys(manifest.dependencies)).not.toContain('@age/bif');
    expect(withoutComments(USE_CASE_SOURCE)).not.toMatch(/@age\/bif/);
  });
});
