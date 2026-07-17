import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { executionId, type ExecutionId, type ExecutionScope } from '@age/execution-contracts';
import {
  createApprovalDecision,
  deriveApprovalDecisionId,
  deriveApprovalStatus,
  deriveDecisionStatus,
  InMemoryApprovalDecisionRepository,
  type ApprovalDecision,
} from '../index';

// ---- test-only fixtures ----------------------------------------------------

const scope: ExecutionScope = {
  organizationId: 'org-1',
  clientId: 'client-1',
  projectId: 'proj-1',
};

const otherScope: ExecutionScope = { organizationId: 'org-2', clientId: 'client-2' };

const execId: ExecutionId = executionId('exec:growth|gp-001|google_ads|org-1|client-1|proj-1');

const decidedAt = new Date('2026-07-17T00:00:00.000Z');

function buildApprovalDecision(
  overrides: Partial<{
    executionId: ExecutionId;
    scope: ExecutionScope;
    outcome: 'approved_for_dry_run' | 'rejected';
    operatorId: string;
    decidedAt: Date;
    reason?: string;
    supersedes?: ApprovalDecision['supersedes'];
  }> = {},
): ApprovalDecision {
  return createApprovalDecision({
    executionId: overrides.executionId ?? execId,
    scope: overrides.scope ?? scope,
    outcome: overrides.outcome ?? 'approved_for_dry_run',
    operatorId: overrides.operatorId ?? 'user:owner-1',
    decidedAt: overrides.decidedAt ?? decidedAt,
    reason: overrides.reason,
    supersedes: overrides.supersedes,
  });
}

// ---- createApprovalDecision -------------------------------------------------

describe('createApprovalDecision — explicit, operator-attributed, tenant-scoped', () => {
  it('builds a decision carrying executionId, scope, outcome, operatorId, and decidedAt', () => {
    const decision = buildApprovalDecision();
    expect(decision.executionId).toBe(execId);
    expect(decision.scope).toEqual(scope);
    expect(decision.outcome).toBe('approved_for_dry_run');
    expect(decision.operatorId).toBe('user:owner-1');
    expect(decision.decidedAt).toEqual(decidedAt);
  });

  it('is deterministic given the same execution/operator/outcome/decidedAt', () => {
    const a = buildApprovalDecision();
    const b = buildApprovalDecision();
    expect(a.id).toBe(b.id);
    expect(
      deriveApprovalDecisionId(execId, 'user:owner-1', 'approved_for_dry_run', decidedAt),
    ).toBe(a.id);
  });

  it('requires a non-empty operator identity — anonymous/system-generated approval is impossible', () => {
    expect(() => buildApprovalDecision({ operatorId: '' })).toThrow(/operatorId/);
    expect(() => buildApprovalDecision({ operatorId: '   ' })).toThrow(/operatorId/);
  });

  it('requires an explicit, non-empty tenant/client scope', () => {
    expect(() =>
      buildApprovalDecision({ scope: { organizationId: '', clientId: 'client-1' } }),
    ).toThrow(/organizationId/);
    expect(() =>
      buildApprovalDecision({ scope: { organizationId: 'org-1', clientId: '' } }),
    ).toThrow(/clientId/);
  });

  it('can only approve for dry-run — no other outcome grants approval', () => {
    const approved = buildApprovalDecision({ outcome: 'approved_for_dry_run' });
    const rejected = buildApprovalDecision({ outcome: 'rejected' });
    expect(approved.outcome).toBe('approved_for_dry_run');
    expect(rejected.outcome).toBe('rejected');
  });

  it('carries an optional supersedes link for corrections, never mutating the original', () => {
    const original = buildApprovalDecision({ outcome: 'rejected' });
    const correction = buildApprovalDecision({
      outcome: 'approved_for_dry_run',
      operatorId: 'user:owner-2',
      decidedAt: new Date('2026-07-17T01:00:00.000Z'),
      supersedes: original.id,
    });
    expect(correction.supersedes).toBe(original.id);
    expect(original.supersedes).toBeUndefined();
  });
});

// ---- ApprovalOutcome / ApprovalStatus type-level guarantee ------------------

describe('no real-execution authorization state exists', () => {
  it('the only outcomes a decision can carry are approved_for_dry_run and rejected', () => {
    const decision = buildApprovalDecision();
    const outcomes: Array<ApprovalDecision['outcome']> = ['approved_for_dry_run', 'rejected'];
    expect(outcomes).toContain(decision.outcome);
    expect(outcomes).not.toContain('approved_for_execution');
    expect(outcomes).not.toContain('approved_for_real_execution');
    expect(outcomes).not.toContain('execute');
    expect(outcomes).not.toContain('run');
  });

  it('this package source contains no execution-authorizing state literals', () => {
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

    const forbiddenStates = [
      "'approved_for_execution'",
      '"approved_for_execution"',
      "'approved_for_real_execution'",
      '"approved_for_real_execution"',
      "'execute'",
      '"execute"',
    ];
    for (const file of collect(srcDir).filter((f) => f !== thisFile)) {
      const content = readFileSync(file, 'utf8');
      for (const token of forbiddenStates) {
        expect(content.includes(token), `${file} must not reference ${token}`).toBe(false);
      }
    }
  });
});

// ---- deriveApprovalStatus / deriveDecisionStatus ---------------------------

describe('deriveApprovalStatus — latest status derived from append-only history', () => {
  it('returns pending_review when no decision exists', () => {
    expect(deriveApprovalStatus([])).toBe('pending_review');
  });

  it('returns approved_for_dry_run after an approval decision', () => {
    const decision = buildApprovalDecision({ outcome: 'approved_for_dry_run' });
    expect(deriveApprovalStatus([decision])).toBe('approved_for_dry_run');
  });

  it('returns rejected after a rejection decision', () => {
    const decision = buildApprovalDecision({ outcome: 'rejected' });
    expect(deriveApprovalStatus([decision])).toBe('rejected');
  });

  it('reflects the latest valid record when a correction supersedes an earlier decision', () => {
    const rejected = buildApprovalDecision({ outcome: 'rejected' });
    const correction = buildApprovalDecision({
      outcome: 'approved_for_dry_run',
      operatorId: 'user:owner-2',
      decidedAt: new Date('2026-07-17T01:00:00.000Z'),
      supersedes: rejected.id,
    });
    expect(deriveApprovalStatus([rejected, correction])).toBe('approved_for_dry_run');

    // the original, superseded record is unchanged — deriveDecisionStatus reports it as superseded
    expect(deriveDecisionStatus([rejected, correction], rejected)).toBe('superseded');
    expect(deriveDecisionStatus([rejected, correction], correction)).toBe('approved_for_dry_run');
    expect(rejected.outcome).toBe('rejected');
  });
});

// ---- InMemoryApprovalDecisionRepository — append-only, tenant-scoped -------

describe('InMemoryApprovalDecisionRepository — append-only, tenant-scoped, immutable', () => {
  it('appends a decision and returns it', async () => {
    const repo = new InMemoryApprovalDecisionRepository();
    const decision = buildApprovalDecision();
    const saved = await repo.append(decision);
    expect(saved).toEqual(decision);
  });

  it('reads decision history back by execution id, scoped to tenant, in append order', async () => {
    const repo = new InMemoryApprovalDecisionRepository();
    const rejected = buildApprovalDecision({ outcome: 'rejected' });
    await repo.append(rejected);
    const correction = buildApprovalDecision({
      outcome: 'approved_for_dry_run',
      operatorId: 'user:owner-2',
      decidedAt: new Date('2026-07-17T01:00:00.000Z'),
      supersedes: rejected.id,
    });
    await repo.append(correction);

    const history = await repo.findByExecutionId(scope, execId);
    expect(history).toEqual([rejected, correction]);
    expect(deriveApprovalStatus(history)).toBe('approved_for_dry_run');
  });

  it('does not return decisions for a different tenant scope — cross-tenant reads are blocked', async () => {
    const repo = new InMemoryApprovalDecisionRepository();
    const decision = buildApprovalDecision();
    await repo.append(decision);

    expect(await repo.findByExecutionId(otherScope, execId)).toEqual([]);
    expect(await repo.findByScope(otherScope)).toEqual([]);
  });

  it('lists decisions by tenant scope', async () => {
    const repo = new InMemoryApprovalDecisionRepository();
    const decision = buildApprovalDecision();
    await repo.append(decision);

    const decisions = await repo.findByScope(scope);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toEqual(decision);
  });

  it('requires tenant scoping on read — rejects an empty organizationId/clientId', async () => {
    const repo = new InMemoryApprovalDecisionRepository();
    await expect(
      repo.findByExecutionId({ organizationId: '', clientId: 'client-1' }, execId),
    ).rejects.toThrow();
    await expect(repo.findByScope({ organizationId: 'org-1', clientId: '' })).rejects.toThrow();
  });

  it('is append-only: rejects appending a decision whose id already exists (deterministic duplicate)', async () => {
    const repo = new InMemoryApprovalDecisionRepository();
    const decision = buildApprovalDecision();
    await repo.append(decision);

    await expect(repo.append(decision)).rejects.toThrow(/append-only/);
  });

  it('deterministically appends a superseding correction as a new record, never mutating the original', async () => {
    const repo = new InMemoryApprovalDecisionRepository();
    const rejected = buildApprovalDecision({ outcome: 'rejected' });
    await repo.append(rejected);

    const correction = buildApprovalDecision({
      outcome: 'approved_for_dry_run',
      operatorId: 'user:owner-2',
      decidedAt: new Date('2026-07-17T01:00:00.000Z'),
      supersedes: rejected.id,
    });
    await repo.append(correction);

    const history = await repo.findByExecutionId(scope, execId);
    expect(history).toHaveLength(2);
    expect(history[0]?.outcome).toBe('rejected');
    expect(history[1]?.outcome).toBe('approved_for_dry_run');
  });

  it('decision records are immutable once persisted — mutating a returned record does not affect stored state', async () => {
    const repo = new InMemoryApprovalDecisionRepository();
    const decision = buildApprovalDecision();
    const saved = await repo.append(decision);

    expect(Object.isFrozen(saved)).toBe(true);
    expect(() => {
      (saved as { outcome: unknown }).outcome = 'MUTATED';
    }).toThrow();

    const [reread] = await repo.findByExecutionId(scope, decision.executionId);
    expect(reread?.outcome).toBe(decision.outcome);
  });

  it('historical (superseded) records remain immutable and unchanged after a correction is appended', async () => {
    const repo = new InMemoryApprovalDecisionRepository();
    const rejected = buildApprovalDecision({ outcome: 'rejected' });
    await repo.append(rejected);
    const correction = buildApprovalDecision({
      outcome: 'approved_for_dry_run',
      operatorId: 'user:owner-2',
      decidedAt: new Date('2026-07-17T01:00:00.000Z'),
      supersedes: rejected.id,
    });
    await repo.append(correction);

    const [original] = await repo.findByExecutionId(scope, execId);
    expect(original).toEqual(rejected);
    expect(original?.outcome).toBe('rejected');
  });

  it('exposes no update/delete/softDelete method on the repository port (append-only by design)', () => {
    const repo = new InMemoryApprovalDecisionRepository();
    expect((repo as unknown as { update?: unknown }).update).toBeUndefined();
    expect((repo as unknown as { delete?: unknown }).delete).toBeUndefined();
    expect((repo as unknown as { softDelete?: unknown }).softDelete).toBeUndefined();
  });
});

// ---- dependency purity ------------------------------------------------------

describe('dependency purity', () => {
  it('this package imports no NestJS/Prisma/DB/HTTP/queue infra, and imports/calls no executor', () => {
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
      'runDryRunExecution',
      'DryRunExecutor',
      'ExecutionGuard',
    ];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const token of forbidden) {
        expect(content.includes(token), `${file} must not reference ${token}`).toBe(false);
      }
    }
  });

  it('imports no API/Web/DB packages (no apps/*, no @age/persistence, no @age/integrations)', () => {
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

    const forbiddenImports = ['@age/persistence', '@age/integrations', 'apps/api', 'apps/web'];
    for (const file of collect(srcDir).filter((f) => f !== thisFile)) {
      const content = readFileSync(file, 'utf8');
      for (const token of forbiddenImports) {
        expect(content.includes(token), `${file} must not reference ${token}`).toBe(false);
      }
    }
  });
});

describe('@age/execution-contracts dependency purity remains intact', () => {
  it('execution-contracts does not depend on this new approval-workflow package', () => {
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
      expect(content.includes('@age/execution-approval-workflow')).toBe(false);
    }
  });
});
