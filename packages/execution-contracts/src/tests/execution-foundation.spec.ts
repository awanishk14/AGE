import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { Capability, ExecutionDomain, type CapabilityOutputItem } from '@age/capability-kit';
import {
  ExecutionStatus,
  ExecutionMode,
  ExecutionRejectionReason,
  ExecutionGuard,
  runDryRunExecution,
  createExecutionRequest,
  deriveExecutionId,
  capabilityOutputItemToIntent,
  TRACEABILITY_CHAIN,
  type ApprovalContext,
  type ExecutionTarget,
  type Executor,
} from '../index';

// ---- test-only fixtures ----------------------------------------------------

const acceptedItem: CapabilityOutputItem = {
  id: 'gp-001',
  capability: Capability.Growth,
  createdAt: new Date('2026-07-12T00:00:00.000Z'),
};

const validTarget: ExecutionTarget = {
  executionDomain: ExecutionDomain.GoogleAds,
  scope: { organizationId: 'org-1', clientId: 'client-1', projectId: 'proj-1' },
};

const approved: ApprovalContext = {
  approved: true,
  approvedBy: 'user:owner-1',
  approvedAt: new Date('2026-07-13T00:00:00.000Z'),
};

const unapproved: ApprovalContext = { approved: false };

function buildRequest(
  overrides: {
    target?: ExecutionTarget;
    approval?: ApprovalContext;
    item?: CapabilityOutputItem;
    summary?: string;
  } = {},
) {
  const intent = capabilityOutputItemToIntent(overrides.item ?? acceptedItem, overrides.summary);
  return createExecutionRequest(
    intent,
    overrides.target ?? validTarget,
    overrides.approval ?? approved,
  );
}

// ---- tests -----------------------------------------------------------------

describe('capabilityOutputItemToIntent (origin mapper)', () => {
  it('preserves the accepted output origin and traceability context', () => {
    const intent = capabilityOutputItemToIntent(acceptedItem);
    expect(intent.capability).toBe(Capability.Growth);
    expect(intent.sourceItemId).toBe('gp-001');
    expect(intent.sourceCreatedAt).toEqual(acceptedItem.createdAt);
  });
});

describe('ExecutionGuard — Human-Approved Execution', () => {
  const guard = new ExecutionGuard();

  it('blocks unapproved execution deterministically', () => {
    const decision = guard.evaluate(buildRequest({ approval: unapproved }));
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error('unreachable');
    expect(decision.status).toBe(ExecutionStatus.BLOCKED);
    expect(decision.reason).toBe(ExecutionRejectionReason.UNAPPROVED);
  });

  it('blocks approval with an empty approver (approval is explicit, not inferred)', () => {
    const decision = guard.evaluate(
      buildRequest({ approval: { approved: true, approvedBy: '  ', approvedAt: new Date() } }),
    );
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error('unreachable');
    expect(decision.reason).toBe(ExecutionRejectionReason.UNAPPROVED);
  });

  it('rejects an invalid execution domain', () => {
    const decision = guard.evaluate(
      buildRequest({
        target: { executionDomain: 'NotADomain' as ExecutionDomain, scope: validTarget.scope },
      }),
    );
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error('unreachable');
    expect(decision.status).toBe(ExecutionStatus.REJECTED);
    expect(decision.reason).toBe(ExecutionRejectionReason.INVALID_EXECUTION_DOMAIN);
  });

  it('rejects an invalid scope (missing client)', () => {
    const decision = guard.evaluate(
      buildRequest({
        target: {
          executionDomain: ExecutionDomain.GoogleAds,
          scope: { organizationId: 'org-1', clientId: '' },
        },
      }),
    );
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error('unreachable');
    expect(decision.reason).toBe(ExecutionRejectionReason.INVALID_SCOPE);
  });

  it('rejects a missing origin', () => {
    const decision = guard.evaluate(
      buildRequest({ item: { id: '  ', capability: Capability.Growth, createdAt: new Date() } }),
    );
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error('unreachable');
    expect(decision.status).toBe(ExecutionStatus.REJECTED);
    expect(decision.reason).toBe(ExecutionRejectionReason.MISSING_ORIGIN);
  });

  it('allows an approved, valid, origin-backed request and derives a plan', () => {
    const decision = guard.evaluate(buildRequest());
    expect(decision.allowed).toBe(true);
    if (!decision.allowed) throw new Error('unreachable');
    expect(decision.plan.mode).toBe(ExecutionMode.DRY_RUN);
    expect(decision.plan.steps.length).toBeGreaterThan(0);
  });
});

describe('runDryRunExecution — dry-run/no-op executor', () => {
  it('completes an approved dry-run with no side effects', () => {
    const result = runDryRunExecution(buildRequest());
    expect(result.status).toBe(ExecutionStatus.DRY_RUN_COMPLETED);
    expect(result.mode).toBe(ExecutionMode.DRY_RUN);
    expect(result.sideEffectsPerformed).toBe(false);
    expect(result.plan).toBeDefined();
    expect(result.audit.sideEffectsPerformed).toBe(false);
  });

  it('unapproved execution is blocked and never reaches the executor', () => {
    const executor: Executor = { execute: vi.fn() };
    const guard = new ExecutionGuard();
    const result = runDryRunExecution(buildRequest({ approval: unapproved }), { guard, executor });
    expect(executor.execute).not.toHaveBeenCalled();
    expect(result.status).toBe(ExecutionStatus.BLOCKED);
    expect(result.sideEffectsPerformed).toBe(false);
  });

  it('invalid target is rejected and never reaches the executor', () => {
    const executor: Executor = { execute: vi.fn() };
    const guard = new ExecutionGuard();
    const result = runDryRunExecution(
      buildRequest({
        target: { executionDomain: 'Nope' as ExecutionDomain, scope: validTarget.scope },
      }),
      { guard, executor },
    );
    expect(executor.execute).not.toHaveBeenCalled();
    expect(result.status).toBe(ExecutionStatus.REJECTED);
  });

  it('only ever produces valid statuses and never performs side effects', () => {
    const valid = new Set<ExecutionStatus>([
      ExecutionStatus.DRY_RUN_COMPLETED,
      ExecutionStatus.BLOCKED,
      ExecutionStatus.REJECTED,
    ]);
    const requests = [
      buildRequest(),
      buildRequest({ approval: unapproved }),
      buildRequest({
        target: { executionDomain: 'X' as ExecutionDomain, scope: validTarget.scope },
      }),
    ];
    for (const request of requests) {
      const result = runDryRunExecution(request);
      expect(valid.has(result.status)).toBe(true);
      expect(result.sideEffectsPerformed).toBe(false);
    }
  });
});

describe('auditability & determinism', () => {
  it('produces an auditable record carrying origin, target, and traceability chain', () => {
    const result = runDryRunExecution(buildRequest());
    const audit = result.audit;
    expect(audit.executionId).toBe(result.executionId);
    expect(audit.capability).toBe(Capability.Growth);
    expect(audit.sourceItemId).toBe('gp-001');
    expect(audit.executionDomain).toBe(ExecutionDomain.GoogleAds);
    expect(audit.scope.clientId).toBe('client-1');
    expect(audit.status).toBe(ExecutionStatus.DRY_RUN_COMPLETED);
    expect(audit.traceability).toBe(TRACEABILITY_CHAIN);
    expect(audit.decidedAt).toEqual(approved.approvedAt);
  });

  it('audits blocked outcomes too (no execution decision is untraceable)', () => {
    const result = runDryRunExecution(buildRequest({ approval: unapproved }));
    expect(result.audit.status).toBe(ExecutionStatus.BLOCKED);
    expect(result.audit.rejectionReason).toBe(ExecutionRejectionReason.UNAPPROVED);
    expect(result.audit.sideEffectsPerformed).toBe(false);
  });

  it('is deterministic: the same request yields an identical result (idempotent by value)', () => {
    const a = runDryRunExecution(buildRequest());
    const b = runDryRunExecution(buildRequest());
    expect(a).toEqual(b);
  });

  it('derives a stable ExecutionId from origin + target', () => {
    const intent = capabilityOutputItemToIntent(acceptedItem);
    expect(deriveExecutionId(intent, validTarget)).toBe(deriveExecutionId(intent, validTarget));
  });
});

describe('dependency purity', () => {
  it('imports no side-effecting / infra modules (db, redis, http, queues, integrations, nest, prisma)', () => {
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
    expect(files.length).toBeGreaterThanOrEqual(10);

    const forbidden = [
      'prisma',
      '@prisma/client',
      '@age/persistence',
      '@age/integrations',
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
