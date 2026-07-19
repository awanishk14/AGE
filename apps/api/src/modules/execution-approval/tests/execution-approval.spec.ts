import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import 'reflect-metadata';
import { describe, expect, it, beforeEach } from 'vitest';
import { InMemoryApprovalDecisionRepository } from '@age/execution-approval-workflow';
import { executionId } from '@age/execution-contracts';
import { ExecutionApprovalService } from '../application/execution-approval.service';
import { ExecutionApprovalController } from '../presentation/execution-approval.controller';

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

const execA = executionId('exec:growth|gp-001|google_ads|org-1|client-1|proj-1');
const execB = executionId('exec:growth|gp-002|google_ads|org-2|client-2|proj-1');

describe('ExecutionApprovalController', () => {
  let repository: InMemoryApprovalDecisionRepository;
  let service: ExecutionApprovalService;
  let controller: ExecutionApprovalController;

  beforeEach(() => {
    repository = new InMemoryApprovalDecisionRepository();
    service = new ExecutionApprovalService(repository);
    controller = new ExecutionApprovalController(service);
  });

  it('is mounted at execution-approval with approve/reject as POST and status/list as GET', () => {
    expect(Reflect.getMetadata('path', ExecutionApprovalController)).toBe('execution-approval');
    expect(Reflect.getMetadata('path', controller.approve)).toBe(':executionId/approve');
    expect(Reflect.getMetadata('method', controller.approve)).toBe(1); // RequestMethod.POST
    expect(Reflect.getMetadata('path', controller.reject)).toBe(':executionId/reject');
    expect(Reflect.getMetadata('method', controller.reject)).toBe(1); // RequestMethod.POST
    expect(Reflect.getMetadata('path', controller.getStatus)).toBe(':executionId');
    expect(Reflect.getMetadata('method', controller.getStatus)).toBe(0); // RequestMethod.GET
    expect(Reflect.getMetadata('path', controller.list)).toBe('/');
    expect(Reflect.getMetadata('method', controller.list)).toBe(0); // RequestMethod.GET
  });

  it('mutation is not possible via GET — approve/reject are not registered as GET handlers', () => {
    const methodNames = Object.getOwnPropertyNames(
      Object.getPrototypeOf(controller) as object,
    ).filter((key) => key !== 'constructor');
    expect(methodNames.sort()).toEqual(['approve', 'getStatus', 'list', 'reject']);
    expect(Reflect.getMetadata('method', controller.approve)).not.toBe(0);
    expect(Reflect.getMetadata('method', controller.reject)).not.toBe(0);
  });

  it('approve requires operatorId', async () => {
    await expect(
      controller.approve(execA, { organizationId: 'org-1', clientId: 'client-1' } as never),
    ).rejects.toThrow(/operatorId/);
    await expect(
      controller.approve(execA, {
        organizationId: 'org-1',
        clientId: 'client-1',
        operatorId: '   ',
      }),
    ).rejects.toThrow(/operatorId/);
  });

  it('approve requires organizationId/clientId', async () => {
    await expect(
      controller.approve(execA, { operatorId: 'user:owner-1' } as never),
    ).rejects.toThrow(/organizationId and clientId/);
    await expect(
      controller.approve(execA, { organizationId: 'org-1', operatorId: 'user:owner-1' } as never),
    ).rejects.toThrow(/organizationId and clientId/);
  });

  it('reject requires operatorId', async () => {
    await expect(
      controller.reject(execA, { organizationId: 'org-1', clientId: 'client-1' } as never),
    ).rejects.toThrow(/operatorId/);
  });

  it('reject requires organizationId/clientId', async () => {
    await expect(controller.reject(execA, { operatorId: 'user:owner-1' } as never)).rejects.toThrow(
      /organizationId and clientId/,
    );
  });

  it('approve records approved_for_dry_run', async () => {
    const decision = await controller.approve(execA, {
      organizationId: 'org-1',
      clientId: 'client-1',
      operatorId: 'user:owner-1',
    });
    expect(decision.outcome).toBe('approved_for_dry_run');
    expect(decision.operatorId).toBe('user:owner-1');
    expect(decision.executionId).toBe(execA);
  });

  it('reject records rejected', async () => {
    const decision = await controller.reject(execA, {
      organizationId: 'org-1',
      clientId: 'client-1',
      operatorId: 'user:owner-1',
    });
    expect(decision.outcome).toBe('rejected');
  });

  it('no real-execution authorization state can be submitted — outcome is always one of the two dry-run literals', async () => {
    const approved = await controller.approve(execA, {
      organizationId: 'org-1',
      clientId: 'client-1',
      operatorId: 'user:owner-1',
    });
    const rejected = await controller.reject(execB, {
      organizationId: 'org-2',
      clientId: 'client-2',
      operatorId: 'user:owner-1',
    });
    const allowed = ['approved_for_dry_run', 'rejected'];
    expect(allowed).toContain(approved.outcome);
    expect(allowed).toContain(rejected.outcome);
  });

  it('read before any decision returns pending_review', async () => {
    const status = await controller.getStatus(execA, 'org-1', 'client-1');
    expect(status.status).toBe('pending_review');
    expect(status.history).toEqual([]);
  });

  it('read after approval returns approved_for_dry_run', async () => {
    await controller.approve(execA, {
      organizationId: 'org-1',
      clientId: 'client-1',
      operatorId: 'user:owner-1',
    });
    const status = await controller.getStatus(execA, 'org-1', 'client-1');
    expect(status.status).toBe('approved_for_dry_run');
  });

  it('read after rejection returns rejected', async () => {
    await controller.reject(execA, {
      organizationId: 'org-1',
      clientId: 'client-1',
      operatorId: 'user:owner-1',
    });
    const status = await controller.getStatus(execA, 'org-1', 'client-1');
    expect(status.status).toBe('rejected');
  });

  it('multiple decisions are append-only and the latest status is derived from history', async () => {
    await controller.reject(execA, {
      organizationId: 'org-1',
      clientId: 'client-1',
      operatorId: 'user:owner-1',
    });
    await controller.approve(execA, {
      organizationId: 'org-1',
      clientId: 'client-1',
      operatorId: 'user:owner-2',
      reason: 'correction after review',
    });
    const status = await controller.getStatus(execA, 'org-1', 'client-1');
    expect(status.status).toBe('approved_for_dry_run');
    expect(status.history).toHaveLength(2);
    expect(status.history[0]?.outcome).toBe('rejected');
    expect(status.history[1]?.outcome).toBe('approved_for_dry_run');
  });

  it('cross-tenant reads do not leak records', async () => {
    await controller.approve(execA, {
      organizationId: 'org-1',
      clientId: 'client-1',
      operatorId: 'user:owner-1',
    });
    await controller.approve(execB, {
      organizationId: 'org-2',
      clientId: 'client-2',
      operatorId: 'user:owner-1',
    });

    const statusOtherScope = await controller.getStatus(execA, 'org-2', 'client-2');
    expect(statusOtherScope.status).toBe('pending_review');
    expect(statusOtherScope.history).toEqual([]);

    const listA = await controller.list('org-1', 'client-1');
    const listB = await controller.list('org-2', 'client-2');
    expect(listA.decisions.map((d) => d.executionId)).not.toContain(execB);
    expect(listB.decisions.map((d) => d.executionId)).not.toContain(execA);
  });

  it('requires organizationId and clientId scope for getStatus() and list()', async () => {
    await expect(controller.getStatus(execA)).rejects.toThrow(/organizationId and clientId/);
    await expect(controller.list()).rejects.toThrow(/organizationId and clientId/);
  });

  it('imports no executor, adapter, queue, worker, scheduler, or external integration', () => {
    const moduleDir = join(__dirname, '..');
    const files = collectTsFiles(moduleDir).filter((f) => f !== __filename);

    const forbidden = [
      'runDryRunExecution',
      'DryRunExecutor',
      'ExecutionGuard',
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

  it('no Web code is touched — module contains no Web/apps/web imports', () => {
    const moduleDir = join(__dirname, '..');
    const files = collectTsFiles(moduleDir).filter((f) => f !== __filename);
    const forbidden = ['apps/web', '@age/web'];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const token of forbidden) {
        expect(content.includes(token), `${file} must not reference ${token}`).toBe(false);
      }
    }
  });

  it('has no execute route or approval-to-execution automation naming', () => {
    const moduleDir = join(__dirname, '..');
    const files = collectTsFiles(moduleDir).filter((f) => f !== __filename);
    const forbidden = ['/execute', "'execute'", '"execute"', 'approved_for_execution'];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const token of forbidden) {
        expect(content.includes(token), `${file} must not reference ${token}`).toBe(false);
      }
    }
  });
});
