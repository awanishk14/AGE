import { readFileSync } from 'node:fs';

import type { ScoredBifSnapshotRecord } from '@age/business-discovery-contracts';
import type { StoredSourceObservation } from '@age/source-observation';
import { describe, expect, it } from 'vitest';

import {
  RELAY_EXIT_CODES,
  RELAY_NOTHING_WAS_APPENDED,
  RELAY_RECORDED_IS_NOT_BELIEVED,
  runRelay,
  type RelayRuntime,
} from '../relay-runner';

/**
 * ADR-0069 D3/D4/D5/D7 — the operator's own act, driven with no database.
 *
 * ⚠️ EVERY FIXTURE IS CONSPICUOUSLY FICTIONAL (ADR-0053 D3, ADR-0065 D1), and
 * 🚫 no peer product is named anywhere in this file: the source system is a
 * fictional string, because `sourceSystem` is DATA and never a branch (D6).
 *
 * ⚠️ WHAT THIS SUITE DOES NOT PROVE. It proves the SHAPE — which scope reached
 * the store, that an inadmissible observation is refused rather than kept, that
 * an absent context is reported as absent rather than as a verdict, and that no
 * write handle is ever acquired on a path that must not write. Whether a row
 * actually lands in PostgreSQL is a fact about the operator's own database.
 * 🚫 This suite must never be cited as if it had shown that.
 */

const REPO_ROOT = '/home/operator/AGE';
const RECORDS_PATH = '/home/operator/private/clients.json';
const OBSERVATION_PATH = '/home/operator/private/observation.json';

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
  '--observation',
  OBSERVATION_PATH,
] as const;

const APPEND_ARGS = [...BASE_ARGS, '--append', '--confirm'] as const;

const envelope = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  subject: { kind: 'modelled', subjectKind: 'service', label: 'Widget Polishing' },
  claim: { direction: 'up', materiality: 'moderate' },
  period: {
    observedAt: '2026-08-01T00:00:00.000Z',
    windowStart: '2026-07-01T00:00:00.000Z',
    windowEnd: '2026-07-31T00:00:00.000Z',
  },
  provenance: {
    sourceSystem: 'fixture-rank-system',
    sourceInstance: 'fixture-instance-1',
    sourceRecordId: 'fixture-record-1',
    organizationScope: 'org-fictional-1',
  },
  claimKind: 'raw-observation',
  ...overrides,
});

const CONTEXT_RECORD = {
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
      bifConfidenceScore: 63,
      bifCompletenessScore: 12,
      sections: [
        {
          id: 'section-products',
          type: 'products_services',
          name: 'Products and Services',
          confidenceScore: 50,
          completenessScore: 50,
          fields: [
            {
              key: 'products',
              value: [{ id: 'offering-fictional-1', name: 'Widget Polishing', type: 'service' }],
              type: 'array',
              required: false,
              source: 'user',
              confidence: 'user_confirmed',
            },
          ],
        },
      ],
      omittedSections: [],
      warnings: [],
      reasons: [],
      metadata: {
        presentSectionCount: 1,
        omittedSectionCount: 11,
        canonicalSectionCount: 12,
        populatedFieldCount: 1,
      },
    },
  },
} as unknown as ScoredBifSnapshotRecord;

interface Harness {
  readonly runtime: RelayRuntime;
  readonly appended: StoredSourceObservation[];
  readonly opened: { context: number; append: number };
  readonly closed: { context: number; append: number };
}

function harness(
  options: {
    readonly observation?: string;
    readonly context?: ScoredBifSnapshotRecord | null;
  } = {},
): Harness {
  const appended: StoredSourceObservation[] = [];
  const opened = { context: 0, append: 0 };
  const closed = { context: 0, append: 0 };

  const files: Record<string, string> = {
    [RECORDS_PATH]: RECORDS_JSON,
    [OBSERVATION_PATH]: options.observation ?? JSON.stringify(envelope()),
  };

  return {
    appended,
    opened,
    closed,
    runtime: {
      readOperatorFileText: (path) => {
        const text = files[path];

        if (text === undefined) {
          throw new Error(`No such fixture file: ${path}`);
        }

        return text;
      },
      newObservationId: () => 'observation-fictional-1',
      now: () => new Date('2026-08-13T10:20:30.456Z'),
      openRelayContextConnection: async () => {
        opened.context += 1;

        return {
          // ⚠️ `'context' in options`, 🚫 not `??` — an explicit `null` is the
          // case under test and must not fall back to the record.
          findLatest: async () =>
            'context' in options ? (options.context ?? null) : CONTEXT_RECORD,
          close: async () => {
            closed.context += 1;
          },
        };
      },
      openObservationAppendConnection: async () => {
        opened.append += 1;

        return {
          append: async (observation) => {
            appended.push(observation);
          },
          close: async () => {
            closed.append += 1;
          },
        };
      },
    },
  };
}

describe('runRelay', () => {
  it('an unknown client reaches no connection at all', async () => {
    const test = harness();
    const result = await runRelay(
      [...BASE_ARGS.slice(0, 5), 'client-not-in-the-file', ...BASE_ARGS.slice(6)],
      test.runtime,
    );

    expect(result.exitCode).toBe(RELAY_EXIT_CODES.clientRecordRefused);
    // 🛑 THE ORDER IS THE ARGUMENT. A run with no scope has no business opening
    // a database connection — not the read one, and certainly not the write one.
    expect(test.opened).toEqual({ context: 0, append: 0 });
  });

  it('assesses without writing, and says so', async () => {
    const test = harness();
    const result = await runRelay(BASE_ARGS, test.runtime);

    expect(result.exitCode).toBe(RELAY_EXIT_CODES.ok);
    expect(result.stdout.join('\n')).toContain(RELAY_NOTHING_WAS_APPENDED);
    // 🛑 `assessOnly` CANNOT WRITE, AND NOT BECAUSE IT DECLINED TO: it never
    // asked for a write handle.
    expect(test.opened.append).toBe(0);
    expect(test.appended).toHaveLength(0);
  });

  it('appends once when confirmed, minting AGE’s own id and recording AGE’s own clock', async () => {
    const test = harness();
    const result = await runRelay(APPEND_ARGS, test.runtime);

    expect(result.exitCode).toBe(RELAY_EXIT_CODES.ok);
    expect(test.appended).toHaveLength(1);

    const stored = test.appended[0] as StoredSourceObservation;

    expect(stored.observationId).toBe('observation-fictional-1');
    expect(stored.sourceRecordId).toBe('fixture-record-1');
    // ⚠️ THE TWO INSTANTS STAY DIFFERENT. `recordedAt` is when AGE recorded it;
    // 🚫 never the source's `observedAt`, or a relay that sat for a month would
    // read as fresh.
    expect(stored.recordedAt).toBe('2026-08-13T10:20:30.456Z');
    expect(stored.period.observedAt).toBe('2026-08-01T00:00:00.000Z');
    // 🛑 THE SCOPE IS THE RECORD'S, and the row carries no client (D7 by shape).
    expect(stored.organizationId).toBe('org-fictional-1');
    expect(stored).not.toHaveProperty('clientId');
    expect(test.closed.append).toBe(1);
  });

  it('says recorded is not believed on the run that recorded', async () => {
    const test = harness();
    const result = await runRelay(APPEND_ARGS, test.runtime);

    // 🛑 D5. Arrival is never confirmation, and the sentence is printed on the
    // one run most likely to be read as confirmation.
    expect(result.stdout.join('\n')).toContain(RELAY_RECORDED_IS_NOT_BELIEVED);
    expect(result.stdout.join('\n')).toContain('it has not verified it');
    expect(result.stdout.join('\n')).not.toMatch(/accepted|confirmed the observation/i);
  });

  it('refuses an observation asserting another organization, and writes nothing', async () => {
    const test = harness({
      observation: JSON.stringify(
        envelope({
          provenance: {
            sourceSystem: 'fixture-rank-system',
            sourceInstance: 'fixture-instance-1',
            sourceRecordId: 'fixture-record-1',
            organizationScope: 'org-fictional-2',
          },
        }),
      ),
    });
    const result = await runRelay(APPEND_ARGS, test.runtime);

    expect(result.exitCode).toBe(RELAY_EXIT_CODES.scopeMismatch);
    // 🚫 NOT rewritten under the record's scope. An observation filed under a
    // business it does not describe is worse than one never relayed.
    expect(test.appended).toHaveLength(0);
    expect(test.opened.append).toBe(0);
  });

  it('reports an absent context as a check that never ran, not as inadmissible', async () => {
    const test = harness({ context: null });
    const result = await runRelay(APPEND_ARGS, test.runtime);

    // 🛑 "AGE HAS NEVER LOOKED" ≠ "AGE LOOKED AND FOUND NOTHING".
    expect(result.exitCode).toBe(RELAY_EXIT_CODES.contextNotFound);
    expect(result.stderr.join(' ')).toContain('the check was never run');
    expect(result.stderr.join(' ')).not.toMatch(/inadmissible:/);
    expect(test.appended).toHaveLength(0);
    expect(test.closed.context).toBe(1);
  });

  it('refuses a subject AGE does not model, and says how many it holds', async () => {
    const test = harness({
      observation: JSON.stringify(
        envelope({
          subject: { kind: 'modelled', subjectKind: 'service', label: 'Something Never Captured' },
        }),
      ),
    });
    const result = await runRelay(APPEND_ARGS, test.runtime);

    // 🛑 THE RULE THAT KEEPS AGE FROM BECOMING A DATA WAREHOUSE (D4).
    expect(result.exitCode).toBe(RELAY_EXIT_CODES.inadmissible);
    expect(result.stderr.join(' ')).toContain('1 modelled subject(s)');
    expect(test.appended).toHaveLength(0);
    expect(test.opened.append).toBe(0);
  });

  it('keeps an unmapped subject as unmapped, and never promotes it', async () => {
    const test = harness({
      observation: JSON.stringify(
        envelope({ subject: { kind: 'unmapped', topicLabel: 'Some Topic AGE Does Not Model' } }),
      ),
    });
    const result = await runRelay(APPEND_ARGS, test.runtime);

    expect(result.exitCode).toBe(RELAY_EXIT_CODES.ok);

    const stored = test.appended[0] as StoredSourceObservation;

    // 🚫 NEVER quietly promoted to the modelled subject sitting next to it.
    expect(stored.subject).toEqual({
      kind: 'unmapped',
      topicLabel: 'Some Topic AGE Does Not Model',
    });
    expect(result.stdout.join('\n')).toContain('admissible as UNMAPPED');
  });

  it('stores AGE’s own label for a modelled subject, not the source’s spelling', async () => {
    const test = harness({
      observation: JSON.stringify(
        envelope({
          // The same subject, spelled the source's way.
          subject: { kind: 'modelled', subjectKind: 'service', label: 'widget polishing' },
        }),
      ),
    });
    const result = await runRelay(APPEND_ARGS, test.runtime);

    expect(result.exitCode).toBe(RELAY_EXIT_CODES.ok);

    const stored = test.appended[0] as StoredSourceObservation;

    // ⚠️ ONE SUBJECT, ONE NAME. Two sources spelling it differently must resolve
    // to the same thing, or "two producers agreeing" is unprovable.
    expect(stored.subject).toEqual({
      kind: 'modelled',
      subjectKind: 'service',
      label: 'Widget Polishing',
    });
  });

  it('refuses an unreadable observation file without echoing its contents', async () => {
    const test = harness({ observation: '{ not json' });
    const result = await runRelay(APPEND_ARGS, test.runtime);

    expect(result.exitCode).toBe(RELAY_EXIT_CODES.observationRefused);
    // 🚫 The file holds a real business's data; the message says what went wrong
    // without repeating what was in it.
    expect(result.stderr.join(' ')).not.toContain('not json');
    expect(test.opened.context).toBe(0);
  });

  it('refuses a malformed envelope by naming the position, never the value', async () => {
    const test = harness({
      observation: JSON.stringify(envelope({ claim: { direction: 'sideways' } })),
    });
    const result = await runRelay(APPEND_ARGS, test.runtime);

    expect(result.exitCode).toBe(RELAY_EXIT_CODES.observationRefused);
    expect(result.stderr.join(' ')).toContain('claim');
    expect(result.stderr.join(' ')).not.toContain('sideways');
    expect(test.appended).toHaveLength(0);
  });

  it('echoes the derived organization and never the client’s display name', async () => {
    const test = harness();
    const result = await runRelay(BASE_ARGS, test.runtime);

    expect(result.stdout.join('\n')).toContain('(from client record, not typed)');
    // 🚫 This output is the thing most likely to be pasted into an issue.
    expect(result.stdout.join('\n')).not.toContain('Wholly Invented Widgets');
  });

  it('names no peer product, so a third-party source relays through the same path', async () => {
    const source = readFileSync(new URL('../relay-runner.ts', import.meta.url), 'utf8').replace(
      /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
      '',
    );

    expect(source.length).toBeGreaterThan(2000);
    // 🚫 SOURCE-NEUTRAL (D6). `sourceSystem` is data, never a branch.
    expect(source).not.toMatch(/rankops|snara|humantik|mcp-ads|content.intelligence/i);
    expect(source).not.toMatch(/sourceSystem\s*===/);
  });
});
