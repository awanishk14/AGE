import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { DemoService } from '../application/demo.service';
import { DemoController } from '../presentation/demo.controller';

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

const EXPECTED_CAPABILITIES = [
  'Intelligence',
  'Market Discovery',
  'Growth',
  'Authority',
  'Operations',
  'Revenue',
];

describe('DemoController GET /demo/capabilities', () => {
  const controller = new DemoController(new DemoService());

  it('is mounted at the demo/capabilities route (Nest returns 200 for a plain @Get)', () => {
    // Route metadata is what Nest uses to register the 200 GET handler.
    expect(Reflect.getMetadata('path', DemoController)).toBe('demo');
    expect(Reflect.getMetadata('path', controller.getCapabilities)).toBe('capabilities');
    expect(Reflect.getMetadata('method', controller.getCapabilities)).toBe(0); // RequestMethod.GET
  });

  it('returns all six capability reports', async () => {
    const response = await controller.getCapabilities();
    expect(response.reports).toHaveLength(6);
    expect(response.reports.map((r) => r.capability)).toEqual(EXPECTED_CAPABILITIES);
  });

  it('reports a total of six pending human approvals', async () => {
    const response = await controller.getCapabilities();
    expect(response.summary.totalPendingApprovals).toBe(6);
  });

  it('exposes accepted/rejected/duplicate/derived counts per capability', async () => {
    const response = await controller.getCapabilities();
    for (const report of response.reports) {
      expect(typeof report.acceptedCount, report.capability).toBe('number');
      expect(typeof report.rejectedCount, report.capability).toBe('number');
      expect(typeof report.duplicateCount, report.capability).toBe('number');
      expect(report.derivedCount).toBe(
        report.acceptedCount + report.rejectedCount + report.duplicateCount,
      );
      expect(report.pendingApproval).toHaveLength(report.acceptedCount);
    }
  });

  it('holds the accounting invariant across all capabilities', async () => {
    const response = await controller.getCapabilities();
    expect(response.summary.accountingInvariantHolds).toBe(true);
    for (const report of response.reports) {
      expect(report.accountingHolds, report.capability).toBe(true);
      expect(report.derivedCount).toBe(report.inputItemCount);
    }
  });

  it('declares Human-Approved Execution, no side effects, and no execution result', async () => {
    const response = await controller.getCapabilities();
    expect(response.humanApprovedExecution).toBe(true);
    expect(response.sideEffectsPerformed).toBe(false);
    // The response is a recommendation only — it must never carry an execution result.
    expect(response).not.toHaveProperty('executionResult');
    for (const report of response.reports) {
      expect(report).not.toHaveProperty('executionResult');
      for (const item of report.acceptedItems as ReadonlyArray<Record<string, unknown>>) {
        expect(item).not.toHaveProperty('executionResult');
      }
    }
  });

  it('exposes a read-only, dry-run-only execution preview (not a real execution result)', async () => {
    const response = await controller.getCapabilities();
    const { executionPreview } = response;

    expect(executionPreview.mode).toBe('dry_run');
    expect(executionPreview.sideEffectsPerformed).toBe(false);
    expect(executionPreview.humanApprovalRequired).toBe(true);
    expect(executionPreview.simulatedApproval.approvedBy).toContain('simulated');
    expect(typeof executionPreview.simulatedApproval.approvedAt).toBe('string');

    // One preview entry per accepted decision object across all six capabilities.
    const totalAccepted = response.reports.reduce((sum, r) => sum + r.acceptedCount, 0);
    expect(executionPreview.entries).toHaveLength(totalAccepted);

    for (const entry of executionPreview.entries) {
      expect(entry.sideEffectsPerformed).toBe(false);
      expect(entry.mode).toBe('dry_run');
      expect(typeof entry.status).toBe('string');
      expect(typeof entry.executionDomain).toBe('string');
      expect(entry.traceability).toContain('Evidence');
      expect(entry).not.toHaveProperty('executionResult');
    }

    // executionPreview must never be mistaken for a real execution result field.
    expect(response).not.toHaveProperty('executionResult');
  });

  it('is read-only: GET /demo/capabilities has no sibling mutation route', () => {
    const controllerMetadataKeys = Object.getOwnPropertyNames(
      Object.getPrototypeOf(controller) as object,
    ).filter((key) => key !== 'constructor');
    // Only the one read-only handler is defined on the controller.
    expect(controllerMetadataKeys).toEqual(['getCapabilities']);
    expect(Reflect.getMetadata('method', controller.getCapabilities)).toBe(0); // RequestMethod.GET
  });

  it('imports no persistence/integration/side-effecting modules in the demo module', () => {
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
    ];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const token of forbidden) {
        expect(content.includes(token), `${file} must not reference ${token}`).toBe(false);
      }
    }
  });
});
