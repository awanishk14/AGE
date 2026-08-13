import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  ScoredBifSnapshotKey,
  ScoredBifSnapshotRecord,
  ScoredBifSnapshotSeriesKey,
} from '@age/business-discovery-contracts';
import { describe, expect, it } from 'vitest';

import { INSPECT_EXIT_CODES, runInspect, type InspectRuntime } from '../inspect-runner';

/**
 * ADR-0055 D1–D5 — the first read of a stored row, driven with no database.
 *
 * ⚠️ EVERY FIXTURE IS CONSPICUOUSLY FICTIONAL (ADR-0053 D3). The row this
 * command was built for holds a real business's answers; 🚫 nothing resembling
 * it may appear in a commit, not even redacted.
 *
 * ⚠️ WHAT THIS SUITE DOES NOT PROVE. It proves the SHAPE: which scope reached
 * the store, that a miss is reported as a miss, that nothing was fabricated when
 * something was absent. Whether the row written on 2026-08-08 actually decodes
 * is a fact about the operator's own database, and only running the command
 * against it answers that. 🚫 This suite must never be cited as if it had.
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

interface Harness {
  readonly runtime: InspectRuntime;
  readonly opened: { count: number };
  readonly closed: { count: number };
  readonly reads: string[];
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
  const reads: string[] = [];
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
    reads,
    byId,
    latest,
    runtime: {
      readOperatorFileText: (path: string): string => {
        reads.push(path);
        const text = files[path];
        if (text === undefined) throw new Error(`ENOENT: ${path}`);
        return text;
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

describe('runInspect — reading the row back', () => {
  it('reads the latest in the series when no snapshot was pinned', async () => {
    const { runtime, latest, byId } = harness();

    const result = await runInspect(BASE_ARGS, runtime);

    expect(result.exitCode).toBe(INSPECT_EXIT_CODES.ok);
    expect(result.stderr).toEqual([]);
    expect(byId).toEqual([]);
    expect(latest).toEqual([
      {
        clientId: 'client-fictional-1',
        organizationId: 'org-fictional-1',
        bifId: 'bif-fictional-1',
      },
    ]);
  });

  it('reads the pinned member when one was given', async () => {
    const { runtime, byId, latest } = harness();

    await runInspect([...BASE_ARGS, '--snapshot-id', 'snap-fictional-1'], runtime);

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
   * ⚠️ THE SCOPE CAME OFF THE RECORD. The organization is never typed, and this
   * is the assertion that says so: a `--organization-id` accepted anywhere in
   * this path would show up here as a scope the record does not describe.
   */
  it('scopes the read with the organization derived from the client record', async () => {
    const { runtime, latest } = harness();

    await runInspect(BASE_ARGS, runtime);

    expect(latest[0]?.organizationId).toBe('org-fictional-1');
  });

  it('echoes the scope, marking the organization as derived', async () => {
    const { runtime } = harness();

    const result = await runInspect(BASE_ARGS, runtime);

    expect(result.stdout).toContain(
      'organizationId:  org-fictional-1 (from client record, not typed)',
    );
  });

  it('does not echo the client display name', async () => {
    // 🚫 This output is the thing most likely to be pasted into an issue.
    const { runtime } = harness();

    const result = await runInspect(BASE_ARGS, runtime);

    expect(result.stdout.join('\n')).not.toContain('Wholly Invented Widgets');
  });

  it('prints what was stored, keeping the BIF scores separate', async () => {
    const { runtime } = harness();

    const result = await runInspect(BASE_ARGS, runtime);
    const out = result.stdout.join('\n');

    expect(out).toContain('snapshotId:      snap-fictional-1');
    expect(out).toContain('capturedAt:      2026-08-08T09:10:11.123Z');
    expect(out).toContain('bifStatus:       Draft');
    expect(out).toContain('bifConfidenceScore:         14');
    expect(out).toContain('bifCompletenessScore:       11');
  });

  /**
   * 🛑 THE DECISION D4 COULD NOT ANTICIPATE. D4 asks for "the four scores kept
   * separate", but a `ScoredBifContext` is projected solely from a BIF, and the
   * two discovery scores live on the discovery profile — deliberately out of
   * scope for the projection, so they are NOT IN THE ROW.
   *
   * 🚫 A `0`, a blank, or simply omitting the lines would each turn "AGE never
   * kept this" into "AGE kept this and it was empty". The line says which
   * artefact holds them instead.
   */
  it('says the two discovery scores are NOT STORED, and never renders them as a number', async () => {
    const { runtime } = harness();

    const result = await runInspect(BASE_ARGS, runtime);
    const out = result.stdout.join('\n');

    expect(out).toContain('discoveryConfidenceScore:   not stored in the snapshot');
    expect(out).toContain('discoveryCompletenessScore: not stored in the snapshot');
    expect(out).not.toMatch(/discovery(Confidence|Completeness)Score:\s+\d/);
  });

  it('NAMES the omitted sections rather than only counting them', async () => {
    // ADR-0026 D4: a limitation you cannot name is indistinguishable from an
    // absence of one.
    const { runtime } = harness();

    const result = await runInspect(BASE_ARGS, runtime);
    const out = result.stdout.join('\n');

    expect(out).toContain('sections omitted (1):');
    expect(out).toContain('  - Financial Profile [financial_profile]');
  });

  /**
   * 🚫 NO AGGREGATE, NO VERDICT. The stored row is 14/11 for a real first
   * client, and that is a CORRECT result (ADR-0054 D7). A word like "weak",
   * "poor" or "incomplete" here would be this command inventing a judgement the
   * scoring layer never made.
   */
  it('renders no verdict, no band and no readiness wording', async () => {
    const { runtime } = harness();

    const result = await runInspect(BASE_ARGS, runtime);

    expect(result.stdout.join('\n').toLowerCase()).not.toMatch(
      /\b(ready|not ready|weak|strong|poor|healthy|score:|overall|grade)\b/,
    );
  });

  it('releases the connection on the way out', async () => {
    const { runtime, opened, closed } = harness();

    await runInspect(BASE_ARGS, runtime);

    expect(opened.count).toBe(1);
    expect(closed.count).toBe(1);
  });
});

describe('runInspect — refusals', () => {
  /**
   * 🚫 A MISS IS NOT AN EMPTY REPORT (D5). "This scope holds no snapshot" is a
   * claim about the query; an empty report reads as a claim about the client.
   */
  it('reports a missing snapshot with its own exit code and says so in words', async () => {
    const { runtime, closed } = harness({ found: null });

    const result = await runInspect(BASE_ARGS, runtime);

    expect(result.exitCode).toBe(INSPECT_EXIT_CODES.snapshotNotFound);
    expect(result.stderr.join(' ')).toContain('No snapshot in this scope');
    expect(closed.count).toBe(1);
    // ⚠️ The scope IS still echoed — the operator must be able to see which
    // scope was searched before concluding anything from the miss.
    expect(result.stdout.join('\n')).toContain('clientId:        client-fictional-1');
    // 🚫 …but no report body, no zeroes, no section lists.
    expect(result.stdout.join('\n')).not.toContain('bifConfidenceScore');
  });

  it('distinguishes a miss on a pinned id from an empty series', async () => {
    const empty = await runInspect(BASE_ARGS, harness({ found: null }).runtime);
    const pinned = await runInspect(
      [...BASE_ARGS, '--snapshot-id', 'snap-not-there'],
      harness({ found: null }).runtime,
    );

    expect(empty.stderr[0]).not.toBe(pinned.stderr[0]);
  });

  it('refuses an unknown client id WITHOUT opening a connection', async () => {
    // ⚠️ Order is load-bearing: a run with no scope has no business reaching a
    // database at all.
    const { runtime, opened } = harness();

    const result = await runInspect(
      [...BASE_ARGS.slice(0, 5), 'client-not-in-the-file', ...BASE_ARGS.slice(6)],
      runtime,
    );

    expect(result.exitCode).toBe(INSPECT_EXIT_CODES.clientRecordRefused);
    expect(opened.count).toBe(0);
    expect(result.stdout).toEqual([]);
  });

  it('refuses a record path inside the repository, before opening anything', async () => {
    const { runtime, reads, opened } = harness();

    const result = await runInspect(
      ['--records', `${REPO_ROOT}/clients.json`, ...BASE_ARGS.slice(2)],
      runtime,
    );

    expect(result.exitCode).toBe(INSPECT_EXIT_CODES.clientRecordRefused);
    expect(reads).toEqual([]);
    expect(opened.count).toBe(0);
    expect(result.stderr.join(' ')).toContain('inside the repository working tree');
    // ⚠️ `.gitignore` is not the control and must never be offered as the fix.
    expect(result.stderr.join(' ')).not.toMatch(/gitignore/i);
  });

  it('refuses an unreadable record file rather than degrading to an empty registry', async () => {
    // 🚫 An empty registry would make every later lookup report "unknown
    // client" for the wrong reason.
    const { runtime, opened } = harness({ files: {} });

    const result = await runInspect(BASE_ARGS, runtime);

    expect(result.exitCode).toBe(INSPECT_EXIT_CODES.clientRecordRefused);
    expect(opened.count).toBe(0);
  });

  it('refuses bad arguments before touching any file or connection', async () => {
    const { runtime, reads, opened } = harness();

    const result = await runInspect([], runtime);

    expect(result.exitCode).toBe(INSPECT_EXIT_CODES.invalidArguments);
    expect(reads).toEqual([]);
    expect(opened.count).toBe(0);
  });

  /**
   * 🛑 A CORRUPT ROW STOPS THE RUN (D5). Stored rows are untrusted input and are
   * re-validated on read; rendering a partially-valid row would be the one
   * outcome worse than stopping. The throw propagates to `main.ts`, which prints
   * the error NAME only — 🚫 never the message, never a stack.
   */
  it('lets a rejected row throw, and still releases the connection', async () => {
    const { runtime, closed } = harness({
      throwOnRead: new Error('snapshotVersion is not a string'),
    });

    await expect(runInspect(BASE_ARGS, runtime)).rejects.toThrow();
    expect(closed.count).toBe(1);
  });
});

/**
 * 🛑 THE STRUCTURAL GUARD (ADR-0055 D2). The refusals above describe what this
 * command does not do. These describe what it CANNOT do — the difference between
 * a convention and a property.
 */
describe('the read path holds no write handle and no series handle', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = (file: string): string => readFileSync(join(here, '..', file), 'utf8');

  it('read the sources it claims to read', () => {
    expect(source('inspect-runner.ts').length).toBeGreaterThan(1000);
    expect(source('capture-composition.ts').length).toBeGreaterThan(1000);
  });

  it('offers no append on the connection the runner is given', async () => {
    const { runtime } = harness();
    const connection = await runtime.openSnapshotReadConnection();

    expect('append' in connection).toBe(false);
    expect(Object.keys(connection).sort()).toEqual(['close', 'findBySnapshotId', 'findLatest']);
  });

  it('never names append or an orchestrator in the runner itself', () => {
    const code = source('inspect-runner.ts')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');

    for (const forbidden of ['.append(', 'Orchestrator', 'produceAndCapture', 'listSeries']) {
      expect(code.includes(forbidden), `inspect-runner.ts must not contain ${forbidden}`).toBe(
        false,
      );
    }
  });

  /**
   * 🚫 `listSeries` IS A SEPARATE REFUSAL from `append`. Cross-snapshot reading
   * — a diff, a trend, "what changed since last capture" — is ADR-0055 §5 item
   * 1: recorded, NOT authorized. It is one bound method away from existing,
   * which is exactly why this asserts the binding is absent.
   */
  /**
   * ⚠️ BOUNDED TO ONE FUNCTION, ON PURPOSE. Slicing to the end of the file made
   * this guard read every door declared after the one it names — so adding the
   * relay's append door (which legitimately binds `append:`) failed the READ
   * door's assertion. A guard that fails for the wrong reason is one loosening
   * away from failing for none.
   */
  const exportedFunctionSource = (root: string, name: string): string => {
    const start = root.indexOf(`export function ${name}`);

    expect(start, `capture-composition.ts must export ${name}`).toBeGreaterThan(-1);

    const next = root.indexOf('\nexport function ', start + 1);

    return next === -1 ? root.slice(start) : root.slice(start, next);
  };

  it('binds no listSeries into the façade the composition root returns', () => {
    const root = source('capture-composition.ts');
    const readFn = exportedFunctionSource(root, 'openLocalPrismaSnapshotReadConnection');

    expect(readFn.length).toBeGreaterThan(200);
    expect(readFn.includes('listSeries:')).toBe(false);
    expect(readFn.includes('append:')).toBe(false);
    // ⚠️ And it asserts the target is local ABOVE constructing the client — a
    // check after construction has already handed the string to a driver.
    expect(readFn.indexOf('assertLocalDatabaseTarget')).toBeLessThan(
      readFn.indexOf('new PrismaClient('),
    );
  });

  /**
   * ADR-0069 D3 — the relay's write door, asserted here so the guard grows with
   * the file rather than being narrowed around it. 🛑 THE WRITE DOOR AND THE
   * READ DOORS ARE SEPARATE: this one binds `append` and nothing that reads,
   * so a path holding it cannot browse, and a path holding a reader cannot
   * write.
   */
  it('binds append — and no read — into the observation write door', () => {
    const root = source('capture-composition.ts');
    const appendFn = exportedFunctionSource(root, 'openLocalPrismaObservationAppendConnection');

    expect(appendFn.length).toBeGreaterThan(200);
    expect(appendFn.includes('append:')).toBe(true);
    for (const forbidden of ['listForOrganization:', 'findLatest:', 'findBySnapshotId:']) {
      expect(appendFn.includes(forbidden), `the append door must not bind ${forbidden}`).toBe(
        false,
      );
    }
    expect(appendFn.indexOf('assertLocalDatabaseTarget')).toBeLessThan(
      appendFn.indexOf('new PrismaClient('),
    );
  });
});
