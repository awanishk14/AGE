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

  it('surfaces the upstream Business Discovery intake as context, not as a capability', async () => {
    const response = await controller.getCapabilities();
    const discovery = response.businessDiscovery;

    expect(discovery.presentSectionTypes).toHaveLength(7);
    expect(discovery.omittedSectionTypes).toHaveLength(5);
    expect(discovery.profileSchemaValid).toBe(true);
    expect(discovery.questionnaireValid).toBe(true);

    // Intake is not a capability: it never enters the approval model, and
    // surfacing it must not change the six-capability accounting.
    expect(discovery).not.toHaveProperty('pendingApproval');
    expect(discovery).not.toHaveProperty('acceptedItems');
    expect(response.reports).toHaveLength(6);
    expect(response.summary.totalPendingApprovals).toBe(6);
    expect(response.reports.map((r) => r.capability)).not.toContain('Business Discovery');
  });

  it('reports the intake and BIF score pairs separately and never promotes the BIF', async () => {
    const response = await controller.getCapabilities();
    const discovery = response.businessDiscovery;

    // The honesty proof: a well-captured interview still yields a sparse Draft
    // BIF. Pinned so the endpoint cannot start flattering the result.
    expect(discovery.discoveryCompletenessScore).toBe(97);
    expect(discovery.discoveryConfidenceScore).toBe(63);
    expect(discovery.bifCompletenessScore).toBe(12);
    expect(discovery.bifConfidenceScore).toBe(17);
    expect(discovery.bifStatus).toBe('Draft');

    // The pairs are distinct measurements — never copies of each other.
    expect(discovery.bifCompletenessScore).not.toBe(discovery.discoveryCompletenessScore);
    expect(discovery.bifConfidenceScore).not.toBe(discovery.discoveryConfidenceScore);
  });

  it('exposes no raw profile payload through the discovery projection', async () => {
    const response = await controller.getCapabilities();
    const discovery = response.businessDiscovery;

    // Compact scalars and string lists only — no evidence URLs, no answers,
    // no nested segment/offering bodies.
    expect(JSON.stringify(discovery)).not.toContain('http');
    for (const [key, value] of Object.entries(discovery)) {
      const isScalar =
        typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
      const isStringList = Array.isArray(value) && value.every((v) => typeof v === 'string');
      expect(isScalar || isStringList, `businessDiscovery.${key} must stay compact`).toBe(true);
    }
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
