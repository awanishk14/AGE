import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEMO_BUSINESS_DISCOVERY_PROFILE,
  DEMO_SCENARIO_METADATA,
  runAllCapabilities,
  runBusinessDiscoveryIntake,
} from '@age/demo-runtime';

/**
 * The CLI app is now a thin shell over `@age/demo-runtime`. These tests assert
 * the app wires the shared runner correctly and stays side-effect-free; the
 * exhaustive runner behaviour is covered in `@age/demo-runtime`.
 */

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

/**
 * The context-readiness stage as the CLI actually renders it.
 *
 * `sample-output.txt` is that stdout, committed byte-for-byte, so scanning it is
 * deterministic and cannot drift from what a reader sees. The slice ends at the
 * first capability run, because the runs are a different contract (see below).
 */
function readReadinessStage(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const golden = readFileSync(join(here, '..', '..', 'sample-output.txt'), 'utf8');
  const start = golden.indexOf('CONTEXT READINESS');
  const end = golden.indexOf('CAPABILITY:');
  // ⚠️ Fail loudly rather than silently scanning an empty string: a slice that
  // found nothing would report perfect compliance.
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return golden.slice(start, end);
}

describe('AGE demo CLI app', () => {
  it('runs all six capabilities via the shared runtime', async () => {
    const reports = await runAllCapabilities();
    expect(reports).toHaveLength(6);
  });

  it('has exactly six decision objects pending human approval', async () => {
    const reports = await runAllCapabilities();
    const pending = reports.reduce((sum, r) => sum + r.acceptedItems.length, 0);
    expect(pending).toBe(6);
  });

  it('runs the upstream Business Discovery intake via the shared runtime', () => {
    const summary = runBusinessDiscoveryIntake(
      DEMO_BUSINESS_DISCOVERY_PROFILE,
      DEMO_SCENARIO_METADATA,
    );
    expect(summary.profileSchemaValid).toBe(true);
    expect(summary.questionnaireValid).toBe(true);
    // Canonical Path B output: populated sections plus first-class omissions.
    expect(summary.presentSectionTypes.length).toBeGreaterThan(0);
    expect(summary.presentSectionTypes.length + summary.omittedSectionTypes.length).toBe(12);
  });

  it('passes the profile and the scenario metadata explicitly at the CLI call site', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, '..', 'run.ts'), 'utf8');
    // ADR-0039 D3 + ADR-0049 D2: BOTH the business being analysed and the three
    // Path B provenance values are named here, at the call site — neither is
    // read from module scope inside the stage that consumes it.
    expect(source).toMatch(
      /runBusinessDiscoveryIntake\(\s*DEMO_BUSINESS_DISCOVERY_PROFILE,\s*DEMO_SCENARIO_METADATA,?\s*\)/,
    );
  });

  it('prints all four scores, so neither pair can stand in for the other', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, '..', 'run.ts'), 'utf8');

    // The intake pair and the BIF pair must both reach the operator. Printing
    // only the intake pair (97/63 on the sample profile) would read as a
    // strong result while the produced Draft BIF is sparse (12/17).
    for (const field of [
      'discoveryCompletenessScore',
      'discoveryConfidenceScore',
      'bifCompletenessScore',
      'bifConfidenceScore',
      'bifStatus',
    ]) {
      expect(source.includes(`summary.${field}`), `run.ts must print ${field}`).toBe(true);
    }
  });

  it('keeps discovery out of the approval model (pending count unchanged)', async () => {
    runBusinessDiscoveryIntake(DEMO_BUSINESS_DISCOVERY_PROFILE, DEMO_SCENARIO_METADATA);
    const reports = await runAllCapabilities();
    const pending = reports.reduce((sum, r) => sum + r.acceptedItems.length, 0);
    expect(pending).toBe(6);
  });

  /**
   * ADR-0047 D7a, the stdout half. The report object is scanned in
   * `@age/demo-runtime`; this scans what the CLI actually RENDERS, because the
   * demo layer authors prose the assessors' own regex scans never see.
   *
   * `sample-output.txt` is that rendered stdout, committed byte-for-byte, so
   * scanning it is deterministic and cannot drift from what a reader sees.
   */
  it('renders no forbidden vocabulary in the readiness stage output (ADR-0047 D7a)', () => {
    // ⚠️ SCOPED TO THE READINESS STAGE, deliberately — not the whole file.
    // The capability RUN output below it legitimately names opportunities
    // (`opportunityId`, `opportunityType`): ADR-0027 D1 binds the readiness
    // ASSESSMENT, not the capability runs, whose whole job is to produce
    // decision objects. Scanning the runs here would forbid the product from
    // doing the thing it exists to do.
    const stage = readReadinessStage();
    const lines = stage.split('\n').filter((l) => l.trim().length > 0);

    // ⚠️ Assert the walk found content FIRST — an empty scan would otherwise
    // report perfect compliance.
    expect(lines.length).toBeGreaterThan(0);
    expect(stage).toContain('CONTEXT READINESS');

    const forbidden =
      /\b(opportunit(y|ies)|recommend(ed|ation|ations)?|plan|action|strateg(y|ic|ies)|upsell|cross-sell|renewal|expansion|next step|should|priorit)/i;

    // Whole-line exemptions: the assessors' sanctioned non-derivation notices,
    // and the demo's own pre-existing banner text. Never a loosened pattern.
    const sanctioned = ['It derives no market opportunity', 'It derives no revenue plan'];

    // 'Vision & Strategy' is a CANONICAL BIF SECTION NAME, not derived strategy.
    // Neutralized as a token so the rest of each line is still scanned.
    const neutralize = (line: string) => line.split("'Vision & Strategy'").join("'<section>'");

    for (const line of lines) {
      if (sanctioned.some((notice) => line.includes(notice))) continue;
      expect(neutralize(line), line).not.toMatch(forbidden);
    }
  });

  /**
   * ADR-0047 D4. The single most important property of this surface: it never
   * reduces three incommensurable states to one number.
   */
  it('prints no aggregate across capabilities in the readiness stage (ADR-0047 D4)', () => {
    const stage = readReadinessStage();

    for (const banned of [
      'overall readiness',
      'most ready',
      'least ready',
      '2 of 3',
      '1 of 3',
      'readiness score',
      'combined readiness',
    ]) {
      expect(stage.toLowerCase()).not.toContain(banned);
    }

    // Fixed registry order, stated positively rather than only by absence.
    const order = [
      'Intelligence',
      'Market Discovery',
      'Growth',
      'Authority',
      'Operations',
      'Revenue',
    ];
    const positions = order.map((name) => stage.indexOf(`  ${name}: `));
    for (const position of positions) expect(position).toBeGreaterThan(-1);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('imports no side-effecting modules in the CLI shell (db, redis, http, queues, integrations)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const srcDir = join(here, '..');
    const thisFile = fileURLToPath(import.meta.url);
    const files = collectTsFiles(srcDir).filter((f) => f !== thisFile);

    const forbidden = [
      'prisma',
      '@age/persistence',
      '@age/integrations',
      'ioredis',
      "'redis'",
      'axios',
      'node:http',
      "from 'http'",
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
