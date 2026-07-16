import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import 'reflect-metadata';
import { describe, expect, it, beforeEach } from 'vitest';
import { Capability, ExecutionDomain, type CapabilityOutputItem } from '@age/capability-kit';
import {
  runDryRunExecution,
  createExecutionRequest,
  capabilityOutputItemToIntent,
  type ApprovalContext,
  type ExecutionTarget,
  type ExecutionScope,
} from '@age/execution-contracts';
import {
  InMemoryExecutionAuditRepository,
  toPersistedExecutionAuditRecord,
} from '@age/execution-audit-persistence';
import { ExecutionAuditService } from '../application/execution-audit.service';
import { ExecutionAuditController } from '../presentation/execution-audit.controller';

/** Recursively collect every .ts file under a directory. */
function collectTsFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectTsFiles(full));
    } else if (entry.isFile() && extname(entry.name) === '.ts') {
      found.push(full);
    }
  }
  return found;
}

// ---- test-only fixtures ----------------------------------------------------

const scopeA: ExecutionScope = { organizationId: 'org-1', clientId: 'client-1' };
const scopeB: ExecutionScope = { organizationId: 'org-2', clientId: 'client-2' };

function buildRecord(scope: ExecutionScope, itemId: string, recordedAt: Date) {
  const item: CapabilityOutputItem = {
    id: itemId,
    capability: Capability.Growth,
    createdAt: recordedAt,
  };
  const target: ExecutionTarget = { executionDomain: ExecutionDomain.GoogleAds, scope };
  const approved: ApprovalContext = {
    approved: true,
    approvedBy: 'user:owner-1',
    approvedAt: recordedAt,
  };
  const intent = capabilityOutputItemToIntent(item);
  const request = createExecutionRequest(intent, target, approved);
  const result = runDryRunExecution(request);
  return toPersistedExecutionAuditRecord(request, result, recordedAt);
}

describe('ExecutionAuditController', () => {
  let repository: InMemoryExecutionAuditRepository;
  let service: ExecutionAuditService;
  let controller: ExecutionAuditController;
  let recordA1: ReturnType<typeof buildRecord>;
  let recordB1: ReturnType<typeof buildRecord>;

  beforeEach(async () => {
    repository = new InMemoryExecutionAuditRepository();
    service = new ExecutionAuditService(repository);
    controller = new ExecutionAuditController(service);

    recordA1 = buildRecord(scopeA, 'gp-001', new Date('2026-07-13T00:00:00.000Z'));
    recordB1 = buildRecord(scopeB, 'gp-002', new Date('2026-07-13T00:01:00.000Z'));
    await repository.append(recordA1);
    await repository.append(recordB1);
  });

  it('is mounted at execution-audit with only read (GET) routes', () => {
    expect(Reflect.getMetadata('path', ExecutionAuditController)).toBe('execution-audit');
    expect(Reflect.getMetadata('path', controller.list)).toBe('/');
    expect(Reflect.getMetadata('method', controller.list)).toBe(0); // RequestMethod.GET
    expect(Reflect.getMetadata('path', controller.findByExecutionId)).toBe(':executionId');
    expect(Reflect.getMetadata('method', controller.findByExecutionId)).toBe(0); // RequestMethod.GET
  });

  it('has no mutation routes on the controller', () => {
    const methodNames = Object.getOwnPropertyNames(
      Object.getPrototypeOf(controller) as object,
    ).filter((key) => key !== 'constructor');
    expect(methodNames.sort()).toEqual(['findByExecutionId', 'list']);
    for (const name of methodNames) {
      // RequestMethod.GET === 0 for every handler — no POST/PUT/PATCH/DELETE.
      expect(Reflect.getMetadata('method', (controller as never)[name])).toBe(0);
    }
  });

  it('requires organizationId and clientId scope for list()', async () => {
    await expect(controller.list()).rejects.toThrow(
      /organizationId and clientId query parameters are required/,
    );
    await expect(controller.list('org-1')).rejects.toThrow(
      /organizationId and clientId query parameters are required/,
    );
  });

  it('requires organizationId and clientId scope for findByExecutionId()', async () => {
    await expect(controller.findByExecutionId(recordA1.executionId)).rejects.toThrow(
      /organizationId and clientId query parameters are required/,
    );
  });

  it('returns only records within the requested scope', async () => {
    const response = await controller.list('org-1', 'client-1');
    expect(response.scope).toEqual({ organizationId: 'org-1', clientId: 'client-1' });
    expect(response.records).toHaveLength(1);
    expect(response.records[0]?.executionId).toBe(recordA1.executionId);
  });

  it('does not leak records from another tenant scope', async () => {
    const responseA = await controller.list('org-1', 'client-1');
    const responseB = await controller.list('org-2', 'client-2');
    expect(responseA.records.map((r) => r.executionId)).not.toContain(recordB1.executionId);
    expect(responseB.records.map((r) => r.executionId)).not.toContain(recordA1.executionId);
  });

  it('reads a single record by executionId within scope', async () => {
    const record = await controller.findByExecutionId(recordA1.executionId, 'org-1', 'client-1');
    expect(record.executionId).toBe(recordA1.executionId);
  });

  it('does not return a record when executionId exists but scope does not match (no cross-tenant read)', async () => {
    await expect(
      controller.findByExecutionId(recordA1.executionId, 'org-2', 'client-2'),
    ).rejects.toThrow();
  });

  it('returns 404-style NotFoundException for an unknown executionId in scope', async () => {
    await expect(
      controller.findByExecutionId('exec_does_not_exist', 'org-1', 'client-1'),
    ).rejects.toThrow();
  });

  it('every returned record is dry-run only with sideEffectsPerformed: false', async () => {
    const response = await controller.list('org-1', 'client-1');
    for (const record of response.records) {
      expect(record.mode).toBe('dry_run');
      expect(record.sideEffectsPerformed).toBe(false);
    }
    const single = await controller.findByExecutionId(recordA1.executionId, 'org-1', 'client-1');
    expect(single.mode).toBe('dry_run');
    expect(single.sideEffectsPerformed).toBe(false);
  });

  it('never exposes a field named executionResult (uses dryRunResultSnapshot instead)', async () => {
    const response = await controller.list('org-1', 'client-1');
    for (const record of response.records) {
      expect(record).not.toHaveProperty('executionResult');
      expect(record).toHaveProperty('dryRunResultSnapshot');
    }
  });

  it('returns an empty list (not an error) when no records exist in scope', async () => {
    const emptyRepository = new InMemoryExecutionAuditRepository();
    const emptyService = new ExecutionAuditService(emptyRepository);
    const emptyController = new ExecutionAuditController(emptyService);
    const response = await emptyController.list('org-empty', 'client-empty');
    expect(response.records).toEqual([]);
  });

  it('imports no persistence/DB/integration modules beyond the approved execution-audit-persistence package', () => {
    const moduleDir = join(__dirname, '..');
    const files = collectTsFiles(moduleDir).filter((f) => f !== __filename);

    const forbidden = [
      'prisma',
      '@prisma/client',
      '@age/persistence',
      '@age/integrations',
      'ioredis',
      "'redis'",
      'axios',
      'kafka',
      'bullmq',
    ];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const token of forbidden) {
        expect(content.includes(token), `${file} must not reference ${token}`).toBe(false);
      }
    }
  });

  it('has no approve/execute routes or naming anywhere in the module', () => {
    const moduleDir = join(__dirname, '..');
    const files = collectTsFiles(moduleDir).filter((f) => f !== __filename);
    const forbidden = [
      '/execute',
      '/approve',
      '/approval',
      '@Post(',
      '@Put(',
      '@Patch(',
      '@Delete(',
    ];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const token of forbidden) {
        expect(content.includes(token), `${file} must not reference ${token}`).toBe(false);
      }
    }
  });
});
