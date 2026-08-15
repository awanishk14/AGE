import { join } from 'node:path';

import {
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  STATED_ANSWER_PROVENANCE,
  buildProfileFromAnswers,
  normalizeScoredBifSnapshotRecord,
  produceScoredBifContext,
  toScoredBifSnapshot,
  type DiscoveryAnswer,
  type ScoredBifSnapshotRecord,
} from '@age/business-discovery-contracts';
import { projectClientContext } from '@age/client-context-projection';
import { describe, expect, it } from 'vitest';

import { readClientContextProjection } from '../client-context-projection';
import { createClientRecord } from '../operator-workspace';
import type { SnapshotReadPort } from '../stored-snapshot';
import { createInMemoryRuntime, FIXTURE_OPERATOR_DIRECTORY } from './in-memory-runtime';

/**
 * ADR-0069 deliverable 7, the read path, exercised.
 *
 * ⚠️ WHAT THESE PROVE THAT NO OTHER SPEC DOES: that the operator is shown the
 * PEER'S OWN ANSWER rather than a console rendering of it, that the operation
 * opens ONE store and never the observation store, and that AGE holding no
 * context is its own outcome instead of a projection with an empty subject list.
 *
 * 🚫 Every fixture is obviously fictional (ADR-0053 D3, ADR-0065 D1).
 */

const RECORD_FILE = join(FIXTURE_OPERATOR_DIRECTORY, 'clients.json');
const CONFIGURED = Object.freeze({ AGE_CLIENT_RECORD_FILE: RECORD_FILE });

const DRAFT = Object.freeze({
  clientId: 'fictional-client-1',
  organizationId: 'org-fictional-1',
  displayName: 'A Fictional Business',
  externalRefsText: '',
});

const CAPTURED_AT = '2026-01-02T00:00:00.000Z';

function storedRecord(): ScoredBifSnapshotRecord {
  const answers: readonly DiscoveryAnswer[] = [
    { questionId: 'bi-name', value: 'Fictional Kite Repair', provenance: STATED_ANSWER_PROVENANCE },
  ];

  const profile = buildProfileFromAnswers(answers, DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE, {
    id: 'profile-fictional',
    capturedAt: '2026-01-01T00:00:00.000Z',
  });

  const { context } = produceScoredBifContext(profile, {
    organizationId: 'org-fictional-1',
    constructedAt: new Date('2026-01-01T00:00:00.000Z'),
    changedBy: 'operator:fictional',
    bifId: 'bif-fictional',
    questionnaire: DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  });

  return normalizeScoredBifSnapshotRecord({
    clientId: 'fictional-client-1',
    organizationId: 'org-fictional-1',
    bifId: 'bif-fictional',
    snapshotId: 'snapshot-fictional',
    capturedAt: CAPTURED_AT,
    snapshot: toScoredBifSnapshot(context),
  });
}

/**
 * ⚠️ HANDLES ARE COUNTED, 🚫 NOT INFERRED FROM OUTPUT. "It did not read the
 * observation store" is proved by the store never having been opened — an
 * assertion on what was rendered would still pass if a connection had been
 * opened and its answer discarded.
 */
interface Harness {
  readonly openContext: () => SnapshotReadPort;
  readonly opened: string[];
  readonly calls: string[];
}

function harness(
  record: ScoredBifSnapshotRecord | null,
  options: { readonly findThrows?: boolean; readonly openThrows?: boolean } = {},
): Harness {
  const opened: string[] = [];
  const calls: string[] = [];

  return {
    opened,
    calls,
    openContext: () => {
      if (options.openThrows === true) {
        throw new Error('DATABASE_URL_APP is not set.');
      }
      opened.push('context');
      return {
        findLatest: async (key) => {
          calls.push(`findLatest:${key.organizationId}:${key.bifId}`);
          if (options.findThrows === true) {
            throw new Error('a stored row failed validation.');
          }
          return record;
        },
        close: async () => {
          calls.push('close:context');
        },
      };
    },
  };
}

async function runtimeWithClient() {
  const runtime = createInMemoryRuntime(CONFIGURED);
  await createClientRecord(runtime, DRAFT);
  return runtime;
}

describe('readClientContextProjection', () => {
  it('🛑 hands back the PEER’S OWN ANSWER, 🚫 not a console rendering of it', async () => {
    const runtime = await runtimeWithClient();
    const record = storedRecord();
    const h = harness(record);

    const outcome = await readClientContextProjection(
      runtime,
      h.openContext,
      'org-fictional-1',
      'fictional-client-1',
      'bif-fictional',
    );

    expect(outcome.kind).toBe('projected');
    if (outcome.kind !== 'projected') return;

    // 🛑 BYTE-IDENTICAL to calling the projection directly. Two answers to
    // "what may a peer name?" would mean the one that drifts is still the one
    // the operator trusts — this asserts there is only ever one.
    expect(outcome.projection).toEqual(
      projectClientContext({ context: record.snapshot.context, asOf: CAPTURED_AT }),
    );
    expect(outcome.organizationId).toBe('org-fictional-1');
  });

  it('⚠️ stamps the STORED capture time, 🚫 never a clock', async () => {
    const runtime = await runtimeWithClient();
    const outcome = await readClientContextProjection(
      runtime,
      harness(storedRecord()).openContext,
      'org-fictional-1',
      'fictional-client-1',
      'bif-fictional',
    );

    expect(outcome.kind === 'projected' ? outcome.projection.asOf : undefined).toBe(CAPTURED_AT);
  });

  it('🛑 opens ONE store — the observation store is not needed and is not reached', async () => {
    const runtime = await runtimeWithClient();
    const h = harness(storedRecord());

    await readClientContextProjection(
      runtime,
      h.openContext,
      'org-fictional-1',
      'fictional-client-1',
      'bif-fictional',
    );

    // 🚫 Mixing in what a source REPORTED would turn a statement about AGE's
    // own model into a statement about what the world has said.
    expect(h.opened).toEqual(['context']);
    expect(h.calls).toEqual(['findLatest:org-fictional-1:bif-fictional', 'close:context']);
  });

  it('🛑 no stored context is its OWN outcome, 🚫 never an empty projection', async () => {
    const runtime = await runtimeWithClient();
    const outcome = await readClientContextProjection(
      runtime,
      harness(null).openContext,
      'org-fictional-1',
      'fictional-client-1',
      'bif-fictional',
    );

    expect(outcome.kind).toBe('no-context');
    if (outcome.kind !== 'no-context') return;
    // 🚫 An empty subject list would tell a reader AGE models nothing here.
    expect(outcome.reason).toContain('nothing to project');
    expect(outcome.reason).toContain('not an empty projection');
    expect(outcome.reason.toLowerCase()).not.toContain('no subjects');
  });

  it('🚫 an unknown business opens NO connection at all', async () => {
    const runtime = createInMemoryRuntime(CONFIGURED);
    const h = harness(storedRecord());

    const outcome = await readClientContextProjection(
      runtime,
      h.openContext,
      'org-fictional-1',
      'not-a-client',
      'bif-fictional',
    );

    expect(outcome.kind).toBe('refused');
    // 🛑 The proof is the ORDER: nothing was opened, not "opened and ignored".
    expect(h.opened).toEqual([]);
    expect(h.calls).toEqual([]);
  });

  it('🚫 a blank BIF id refuses BEFORE the scope is even resolved', async () => {
    const runtime = await runtimeWithClient();
    const h = harness(storedRecord());

    const outcome = await readClientContextProjection(
      runtime,
      h.openContext,
      'org-fictional-1',
      'fictional-client-1',
      '   ',
    );

    expect(outcome.kind).toBe('refused');
    if (outcome.kind !== 'refused') return;
    expect(outcome.reason).toContain('AGE cannot derive it');
    expect(h.opened).toEqual([]);
  });

  it('⚠️ closes the port even when the read throws, and names it a QUERY fault', async () => {
    const runtime = await runtimeWithClient();
    const h = harness(storedRecord(), { findThrows: true });

    const outcome = await readClientContextProjection(
      runtime,
      h.openContext,
      'org-fictional-1',
      'fictional-client-1',
      'bif-fictional',
    );

    expect(outcome.kind).toBe('refused');
    if (outcome.kind !== 'refused') return;
    // 🚫 A row that failed validation is not projected in part.
    expect(outcome.reason).toContain('not a row AGE can describe in part');
    expect(h.calls).toContain('close:context');
  });

  it('⚠️ a deployment fault is named, 🚫 and no connection string travels', async () => {
    const runtime = await runtimeWithClient();
    const outcome = await readClientContextProjection(
      runtime,
      harness(null, { openThrows: true }).openContext,
      'org-fictional-1',
      'fictional-client-1',
      'bif-fictional',
    );

    expect(outcome.kind).toBe('refused');
    if (outcome.kind !== 'refused') return;
    expect(outcome.reason).toContain('DATABASE_URL_APP');
    expect(outcome.reason).not.toContain('postgres://');
  });

  it('🚫 an unconfigured console names the variable, and reaches nothing', async () => {
    const runtime = createInMemoryRuntime({});
    const h = harness(storedRecord());

    const outcome = await readClientContextProjection(
      runtime,
      h.openContext,
      'org-fictional-1',
      'fictional-client-1',
      'bif-fictional',
    );

    expect(outcome.kind).toBe('not-configured');
    expect(h.opened).toEqual([]);
  });
});
