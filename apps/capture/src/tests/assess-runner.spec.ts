import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  ScoredBifSnapshotKey,
  ScoredBifSnapshotRecord,
  ScoredBifSnapshotSeriesKey,
} from '@age/business-discovery-contracts';
import { describe, expect, it } from 'vitest';

import { ASSESS_EXIT_CODES, runAssess, type AssessRuntime } from '../assess-runner';

/**
 * ADR-0063 — the first code path in AGE that REASONS over a stored row, driven
 * with no database and no clock.
 *
 * ⚠️ EVERY FIXTURE IS CONSPICUOUSLY FICTIONAL (ADR-0053 D3). The row this
 * command was built for holds a real business's answers; 🚫 nothing resembling
 * it may appear in a commit, not even redacted.
 *
 * ⚠️ WHAT THIS SUITE DOES NOT PROVE — the same limit as `inspect`'s, and it
 * matters more here. It proves the SHAPE of the assessment: that all six
 * capabilities are named, that the three without an assessor say so, that an
 * absent sufficiency is not turned into `ready`, that nothing is aggregated.
 * 🚫 It does NOT prove what the operator's real row assesses to. That number
 * comes from their own database and only their own run produces it.
 *
 * ⚠️ AND `insufficient` IS A PASS (ADR-0063 D9). No assertion in this file
 * requires a particular state, because requiring one would be the first step
 * toward tuning a threshold until the fixture looked good.
 */

const REPO_ROOT = '/home/operator/AGE';
const RECORDS_PATH = '/home/operator/private/clients.json';

const RECORDS_JSON = JSON.stringify({
  records: [
    {
      clientId: 'client-fictional-1',
      organizationId: 'org-fictional-1',
      displayName: 'Wholly Invented Widgets (FICTIONAL)',
      externalRefs: {},
    },
  ],
});

const BASE_ARGS = [
  '--records',
  RECORDS_PATH,
  '--repository-root',
  REPO_ROOT,
  '--client-id',
  'client-fictional-1',
  '--bif-id',
  'bif-fictional-1',
] as const;

/**
 * ⚠️ SHAPED LIKE THE REAL ROW, DELIBERATELY THIN. Confidence 14 / completeness
 * 11 with most sections omitted is what the 2026-08-08 capture actually stored.
 * A rich fixture would let every assessor answer `ready` and this suite would
 * then prove nothing about the case AGE is actually in.
 */
const RECORD: ScoredBifSnapshotRecord = {
  clientId: 'client-fictional-1',
  organizationId: 'org-fictional-1',
  bifId: 'bif-fictional-1',
  snapshotId: 'snap-fictional-1',
  capturedAt: '2026-08-08T09:10:11.123Z',
  snapshot: {
    snapshotVersion: '1.0.0',
    context: {
      contextVersion: '1.0.0',
      bifId: 'bif-fictional-1',
      bifStatus: 'Draft',
      bifConfidenceScore: 14,
      bifCompletenessScore: 11,
      sections: [
        {
          id: 'section-1',
          type: 'business_identity',
          name: 'Business Identity',
          confidenceScore: 20,
          completenessScore: 25,
          fields: [],
        },
      ],
      omittedSections: [{ type: 'financial_profile', name: 'Financial Profile' }],
      warnings: [],
      reasons: [],
      metadata: {
        presentSectionCount: 1,
        omittedSectionCount: 1,
        canonicalSectionCount: 2,
        populatedFieldCount: 0,
      },
    },
  },
} as unknown as ScoredBifSnapshotRecord;

const ASSESSED_AT = new Date('2026-08-08T12:00:00.000Z');

interface Harness {
  readonly runtime: AssessRuntime;
  readonly opened: { count: number };
  readonly closed: { count: number };
  readonly clocks: { count: number };
  readonly byId: ScoredBifSnapshotKey[];
  readonly latest: ScoredBifSnapshotSeriesKey[];
}

function harness(
  options: {
    readonly found?: ScoredBifSnapshotRecord | null;
    readonly throwOnRead?: Error;
    readonly files?: Readonly<Record<string, string>>;
  } = {},
): Harness {
  const opened = { count: 0 };
  const closed = { count: 0 };
  const clocks = { count: 0 };
  const byId: ScoredBifSnapshotKey[] = [];
  const latest: ScoredBifSnapshotSeriesKey[] = [];
  const files = options.files ?? { [RECORDS_PATH]: RECORDS_JSON };
  const found = options.found === undefined ? RECORD : options.found;

  const answer = async (): Promise<ScoredBifSnapshotRecord | null> => {
    if (options.throwOnRead !== undefined) throw options.throwOnRead;
    return found;
  };

  return {
    opened,
    closed,
    clocks,
    byId,
    latest,
    runtime: {
      readOperatorFileText: (path: string): string => {
        const text = files[path];
        if (text === undefined) throw new Error(`ENOENT: ${path}`);
        return text;
      },
      now: (): Date => {
        clocks.count += 1;
        return ASSESSED_AT;
      },
      openSnapshotReadConnection: async () => {
        opened.count += 1;

        return {
          findBySnapshotId: async (key: ScoredBifSnapshotKey) => {
            byId.push(key);
            return answer();
          },
          findLatest: async (key: ScoredBifSnapshotSeriesKey) => {
            latest.push(key);
            return answer();
          },
          close: async () => {
            closed.count += 1;
          },
        };
      },
    },
  };
}

/** The `Capability` enum's own values, in the order the printer emits them. */
const ALL_SIX = [
  'MarketDiscovery',
  'Intelligence',
  'Growth',
  'Authority',
  'Operations',
  'Revenue',
] as const;

const WITHOUT_ASSESSOR = ['Growth', 'Authority', 'Operations'] as const;

/**
 * ⚠️ COMMENTS ARE STRIPPED BEFORE ANY SOURCE SCAN. Without this a module's own
 * explanation of a rule matches the token the rule bans, and the guard reports a
 * violation that is really documentation — or, worse, a later reader deletes the
 * explanation to make the guard pass.
 */
function strippedSource(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('runAssess — the first assessment of a stored row', () => {
  it('reads the latest in the series when no snapshot was pinned', async () => {
    const { runtime, latest, byId, opened, closed } = harness();

    const result = await runAssess(BASE_ARGS, runtime);

    expect(result.exitCode).toBe(ASSESS_EXIT_CODES.ok);
    expect(result.stderr).toEqual([]);
    expect(byId).toEqual([]);
    expect(latest).toEqual([
      {
        clientId: 'client-fictional-1',
        organizationId: 'org-fictional-1',
        bifId: 'bif-fictional-1',
      },
    ]);
    expect(opened.count).toBe(1);
    expect(closed.count).toBe(1);
  });

  it('reads the pinned member when one was given', async () => {
    const { runtime, byId, latest } = harness();

    await runAssess([...BASE_ARGS, '--snapshot-id', 'snap-fictional-1'], runtime);

    expect(latest).toEqual([]);
    expect(byId).toEqual([
      {
        clientId: 'client-fictional-1',
        organizationId: 'org-fictional-1',
        bifId: 'bif-fictional-1',
        snapshotId: 'snap-fictional-1',
      },
    ]);
  });

  /**
   * ADR-0063 D4. ⚠️ The capabilities WITHOUT an assessor are the point of this
   * test: a surface that silently drops what it never examined turns "AGE has
   * never looked" into "AGE looked and found nothing wrong".
   */
  it('names all six capabilities, and says of three that they expose no assessor', async () => {
    const { runtime } = harness();

    const out = (await runAssess(BASE_ARGS, runtime)).stdout.join('\n');

    for (const capability of ALL_SIX) {
      expect(out).toContain(capability);
    }

    const notAssessed = out.match(/not-assessed — this capability exposes no context assessor/g);
    expect(notAssessed).toHaveLength(3);

    for (const capability of WITHOUT_ASSESSOR) {
      expect(out).toMatch(
        new RegExp(`^${capability}\\n {2}not-assessed — this capability exposes no`, 'm'),
      );
    }
  });

  /**
   * ADR-0063 D6. 🚫 An aggregate over three assessed and three not-assessed
   * capabilities is arithmetic over a value that does not exist, and it would
   * read as a measurement of the business.
   */
  it('renders no aggregate, no band and no overall verdict', async () => {
    const { runtime } = harness();

    const out = (await runAssess(BASE_ARGS, runtime)).stdout.join('\n');

    expect(out).not.toMatch(/\boverall\b/i);
    expect(out).not.toMatch(/\baggregate\b/i);
    expect(out).not.toMatch(/\bverdict\b/i);
    expect(out).not.toMatch(/\bband\b/i);
    expect(out).not.toMatch(/\bgrade\b/i);
    expect(out).not.toMatch(/\b\d+ of \d+ (ready|capabilities)\b/i);
    expect(out).not.toMatch(/\bscore:/i);
  });

  /**
   * ADR-0063 D5 + the non-negotiable semantics: `sufficiency` omitted stays
   * undefined, 🚫 never defaulted to `ready`.
   */
  it('renders an absent sufficiency as an absence, never as ready', async () => {
    const { runtime } = harness();

    const out = (await runAssess(BASE_ARGS, runtime)).stdout.join('\n');

    // Whatever the assessors returned for this thin row, no capability heading
    // may be followed by nothing, and nothing may be silently filled in.
    for (const capability of ALL_SIX) {
      const block = out.split(`\n${capability}\n`)[1];
      expect(block).toBeDefined();
      expect((block ?? '').split('\n')[0]?.trim().length ?? 0).toBeGreaterThan(0);
    }

    const source = strippedSource(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'assess-runner.ts'),
    );
    expect(source).toContain('not-stated');
    expect(source).not.toMatch(/sufficiency\s*\?\?\s*\{/);

    // ⚠️ THE STRONGER HALF, and the reason the assertion above is not enough.
    // This fixture never produces an absent sufficiency, so no output check can
    // reach that branch. What CAN be checked is that the printer owns no state
    // word of its own: every state it emits must come from the assessor.
    expect(source).toMatch(/\$\{sufficiency\.state\}/);
    // ⚠️ THE BARE WORD, not a quote-adjacent one. `'  state:    ready'` puts the
    // word nowhere near the quote, and a narrower pattern let exactly that
    // mutation through on the first attempt.
    expect(source).not.toMatch(/\b(ready|partial|insufficient|blocked)\b/i);
  });

  /**
   * ADR-0063 D9 item 2. The state alone is the least useful half: "insufficient"
   * without "the pricing section is absent" is a verdict the operator cannot act
   * on or contest.
   */
  it('prints the assessors own reasons alongside each assessed state', async () => {
    const { runtime } = harness();

    const out = (await runAssess(BASE_ARGS, runtime)).stdout.join('\n');

    const states = out.match(/^ {2}state: {4}(ready|partial|insufficient|blocked)$/gm);
    expect(states).toHaveLength(3);
    expect(out.match(/^ {2}reasons:$/gm)).toHaveLength(3);
    expect(out).toMatch(/^ {4}- .+$/m);
  });

  /** ADR-0063 D8 — the clock is injected, and used exactly once. */
  it('takes producedAt from the injected runtime', async () => {
    const { runtime, clocks } = harness();

    const out = (await runAssess(BASE_ARGS, runtime)).stdout.join('\n');

    expect(clocks.count).toBe(1);
    expect(out).toContain(`assessedAt:      ${ASSESSED_AT.toISOString()}`);
  });

  /**
   * 🚫 The client display name is never echoed — this output is the thing most
   * likely to be pasted into an issue, and the record file holds a real
   * business's name.
   */
  it('echoes the derived scope and never the client display name', async () => {
    const { runtime } = harness();

    const out = (await runAssess(BASE_ARGS, runtime)).stdout.join('\n');

    expect(out).toContain('organizationId:  org-fictional-1 (from client record, not typed)');
    expect(out).not.toContain('Wholly Invented Widgets');
  });

  it('refuses --organization-id by name, without opening a connection', async () => {
    const { runtime, opened } = harness();

    const result = await runAssess([...BASE_ARGS, '--organization-id', 'org-other'], runtime);

    expect(result.exitCode).toBe(ASSESS_EXIT_CODES.invalidArguments);
    expect(result.stderr.join('\n')).toContain('--organization-id');
    expect(opened.count).toBe(0);
  });

  it('refuses an unknown client without opening a connection', async () => {
    const { runtime, opened } = harness();

    const result = await runAssess(
      [
        '--records',
        RECORDS_PATH,
        '--repository-root',
        REPO_ROOT,
        '--client-id',
        'client-nope',
        '--bif-id',
        'bif-fictional-1',
      ],
      runtime,
    );

    expect(result.exitCode).toBe(ASSESS_EXIT_CODES.clientRecordRefused);
    expect(opened.count).toBe(0);
  });

  /**
   * 🚫 NEVER AN EMPTY ASSESSMENT. "No snapshot in this scope" is a statement
   * about the query; six capabilities reported over nothing would be a statement
   * about the client.
   */
  it('reports a miss as a miss, with no capability block at all', async () => {
    const { runtime, closed } = harness({ found: null });

    const result = await runAssess(BASE_ARGS, runtime);

    expect(result.exitCode).toBe(ASSESS_EXIT_CODES.snapshotNotFound);
    expect(result.stderr.join('\n')).toContain('No snapshot in this scope');
    expect(result.stdout.join('\n')).not.toContain('not-assessed');
    expect(closed.count).toBe(1);
  });

  /**
   * Stored rows are untrusted input; assessing a partially-valid row would be
   * strictly worse than stopping, because the assessment would look exactly as
   * authoritative as an honest one.
   */
  it('lets a corrupt rows throw propagate, and still closes the connection', async () => {
    const { runtime, closed } = harness({ throwOnRead: new Error('decode failed') });

    await expect(runAssess(BASE_ARGS, runtime)).rejects.toThrow('decode failed');
    expect(closed.count).toBe(1);
  });
});

/**
 * ADR-0063 D2/D3/D7 — the refusals that a later slice is most likely to undo by
 * accident, asserted against the source rather than the output.
 */
describe('runAssess — the shipped refusals', () => {
  const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
  const source = strippedSource(join(appRoot, 'assess-runner.ts'));

  it('never imports the demo runtime, anywhere in this app (D2)', () => {
    const files = [
      'assess-runner.ts',
      'inspect-runner.ts',
      'capture-runner.ts',
      'onboarding-runner.ts',
      'capture-cli.ts',
      'capture-composition.ts',
      'index.ts',
      'main.ts',
    ];

    let examined = 0;
    for (const file of files) {
      const text = strippedSource(join(appRoot, file));
      examined += 1;
      expect(text).not.toContain('@age/demo-runtime');
      expect(text).not.toContain('buildContextReadinessReport');
    }

    expect(examined).toBe(files.length);
  });

  it('calls no capability run and constructs no capability input (D3)', () => {
    expect(source).not.toMatch(/\brunMarketDiscovery\b|\brunIntelligence\b|\brunRevenue\b/);
    expect(source).not.toMatch(/EvidencePackage|RevenueInput|MarketDiscoveryInput/);
    expect(source).not.toMatch(/\.run\(/);
  });

  it('opens no new connection and names no write (D7)', () => {
    expect(source).not.toContain('.append(');
    expect(source).not.toContain('produceAndCapture');
    expect(source).not.toContain('Orchestrator');
    expect(source).not.toContain('listSeries');
    expect(source).not.toContain('new PrismaClient(');
  });
});
