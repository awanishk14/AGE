import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Capability, ExecutionDomain, type CapabilityOutputItem } from '@age/capability-kit';
import {
  runDryRunExecution,
  createExecutionRequest,
  capabilityOutputItemToIntent,
  TRACEABILITY_CHAIN,
  type ApprovalContext,
  type ExecutionTarget,
  type ExecutionScope,
} from '@age/execution-contracts';
import { toPersistedExecutionAuditRecord, InMemoryExecutionAuditRepository } from '../index';

// ---- test-only fixtures ----------------------------------------------------

const acceptedItem: CapabilityOutputItem = {
  id: 'gp-001',
  capability: Capability.Growth,
  createdAt: new Date('2026-07-12T00:00:00.000Z'),
};

const scope: ExecutionScope = {
  organizationId: 'org-1',
  clientId: 'client-1',
  projectId: 'proj-1',
};

const validTarget: ExecutionTarget = {
  executionDomain: ExecutionDomain.GoogleAds,
  scope,
};

const approved: ApprovalContext = {
  approved: true,
  approvedBy: 'user:owner-1',
  approvedAt: new Date('2026-07-13T00:00:00.000Z'),
};

const recordedAt = new Date('2026-07-13T00:05:00.000Z');

function buildDryRunOutcome(
  overrides: { target?: ExecutionTarget; item?: CapabilityOutputItem } = {},
) {
  const intent = capabilityOutputItemToIntent(overrides.item ?? acceptedItem);
  const request = createExecutionRequest(intent, overrides.target ?? validTarget, approved);
  const result = runDryRunExecution(request);
  return { request, result };
}

// ---- tests -----------------------------------------------------------------

describe('toPersistedExecutionAuditRecord', () => {
  it('builds a dry-run audit persisted record preserving id/request/plan/result/audit traceability', () => {
    const { request, result } = buildDryRunOutcome();
    const record = toPersistedExecutionAuditRecord(request, result, recordedAt);

    expect(record.id).toBe(result.executionId);
    expect(record.executionId).toBe(request.id);
    expect(record.scope).toEqual(scope);
    expect(record.status).toBe(result.status);
    expect(record.traceability).toBe(TRACEABILITY_CHAIN);
    expect(record.requestSnapshot).toEqual(request);
    expect(record.planSnapshot).toEqual(result.plan);
    expect(record.resultSnapshot).toEqual(result);
    expect(record.auditSnapshot).toEqual(result.audit);
    expect(record.createdAt).toEqual(recordedAt);
    expect(record.decidedAt).toEqual(result.audit.decidedAt);
  });

  it('always persists sideEffectsPerformed: false', () => {
    const { request, result } = buildDryRunOutcome();
    const record = toPersistedExecutionAuditRecord(request, result, recordedAt);
    expect(record.sideEffectsPerformed).toBe(false);
  });

  it('refuses to build a record for a result whose executionId does not match the request', () => {
    const { request } = buildDryRunOutcome();
    const { result: unrelatedResult } = buildDryRunOutcome({
      item: { id: 'gp-002', capability: Capability.Growth, createdAt: new Date() },
    });
    expect(() => toPersistedExecutionAuditRecord(request, unrelatedResult, recordedAt)).toThrow();
  });

  it('is deterministic given the same request/result/createdAt', () => {
    const { request, result } = buildDryRunOutcome();
    const a = toPersistedExecutionAuditRecord(request, result, recordedAt);
    const b = toPersistedExecutionAuditRecord(request, result, recordedAt);
    expect(a).toEqual(b);
  });
});

describe('InMemoryExecutionAuditRepository — append-only, tenant-scoped persistence', () => {
  it('creates a dry-run audit record via append', async () => {
    const repo = new InMemoryExecutionAuditRepository();
    const { request, result } = buildDryRunOutcome();
    const record = toPersistedExecutionAuditRecord(request, result, recordedAt);

    const saved = await repo.append(record);
    expect(saved).toEqual(record);
  });

  it('reads a record back by execution id, scoped to tenant', async () => {
    const repo = new InMemoryExecutionAuditRepository();
    const { request, result } = buildDryRunOutcome();
    const record = toPersistedExecutionAuditRecord(request, result, recordedAt);
    await repo.append(record);

    const found = await repo.findByExecutionId(scope, record.executionId);
    expect(found).toEqual(record);
  });

  it('does not return a record for a different tenant scope', async () => {
    const repo = new InMemoryExecutionAuditRepository();
    const { request, result } = buildDryRunOutcome();
    const record = toPersistedExecutionAuditRecord(request, result, recordedAt);
    await repo.append(record);

    const otherScope: ExecutionScope = { organizationId: 'org-2', clientId: 'client-2' };
    const found = await repo.findByExecutionId(otherScope, record.executionId);
    expect(found).toBeNull();
    expect(await repo.findByScope(otherScope)).toEqual([]);
  });

  it('lists records by tenant scope', async () => {
    const repo = new InMemoryExecutionAuditRepository();
    const { request, result } = buildDryRunOutcome();
    const record = toPersistedExecutionAuditRecord(request, result, recordedAt);
    await repo.append(record);

    const records = await repo.findByScope(scope);
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual(record);
  });

  it('requires tenant scoping — rejects an empty organizationId/clientId', async () => {
    const repo = new InMemoryExecutionAuditRepository();
    const { request, result } = buildDryRunOutcome({
      target: {
        executionDomain: ExecutionDomain.GoogleAds,
        scope: { organizationId: '', clientId: 'client-1' },
      },
    });
    const record = toPersistedExecutionAuditRecord(request, result, recordedAt);
    await expect(repo.append(record)).rejects.toThrow();
  });

  it('is append-only: rejects appending a record with an executionId that already exists', async () => {
    const repo = new InMemoryExecutionAuditRepository();
    const { request, result } = buildDryRunOutcome();
    const record = toPersistedExecutionAuditRecord(request, result, recordedAt);
    await repo.append(record);

    await expect(repo.append(record)).rejects.toThrow(/append-only/);
  });

  it('records are immutable once persisted — mutating a returned record does not affect stored state', async () => {
    const repo = new InMemoryExecutionAuditRepository();
    const { request, result } = buildDryRunOutcome();
    const record = toPersistedExecutionAuditRecord(request, result, recordedAt);
    const saved = await repo.append(record);

    expect(Object.isFrozen(saved)).toBe(true);
    expect(() => {
      (saved as { status: unknown }).status = 'MUTATED';
    }).toThrow();

    const reread = await repo.findByExecutionId(scope, record.executionId);
    expect(reread?.status).toBe(record.status);
  });

  it('exposes no update/delete method on the repository port (append-only by design)', () => {
    const repo = new InMemoryExecutionAuditRepository();
    expect((repo as unknown as { update?: unknown }).update).toBeUndefined();
    expect((repo as unknown as { delete?: unknown }).delete).toBeUndefined();
    expect((repo as unknown as { softDelete?: unknown }).softDelete).toBeUndefined();
  });
});

describe('dependency purity', () => {
  it('this package imports no NestJS/Prisma/DB/HTTP/queue infra — port + in-memory reference only', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const srcDir = join(here, '..');
    const thisFile = fileURLToPath(import.meta.url);

    const collect = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...collect(full));
        else if (entry.isFile() && extname(entry.name) === '.ts') out.push(full);
      }
      return out;
    };

    const files = collect(srcDir).filter((f) => f !== thisFile);
    expect(files.length).toBeGreaterThanOrEqual(6);

    const forbidden = [
      'prisma',
      '@prisma/client',
      'ioredis',
      "'redis'",
      'axios',
      'node:http',
      "from 'http'",
      'kafka',
      '@nestjs',
    ];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const token of forbidden) {
        expect(content.includes(token), `${file} must not reference ${token}`).toBe(false);
      }
    }
  });
});

describe('@age/execution-contracts dependency purity remains intact', () => {
  it('execution-contracts does not depend on this new persistence package', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const contractsSrc = join(here, '../../../execution-contracts/src');

    const collect = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...collect(full));
        else if (entry.isFile() && extname(entry.name) === '.ts') out.push(full);
      }
      return out;
    };

    for (const file of collect(contractsSrc)) {
      const content = readFileSync(file, 'utf8');
      expect(content.includes('@age/execution-audit-persistence')).toBe(false);
    }
  });
});
