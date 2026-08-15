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
import type { StoredSourceObservation } from '@age/source-observation';
import { describe, expect, it } from 'vitest';

import { readDerivedIntelligence } from '../derived-intelligence';
import { createClientRecord } from '../operator-workspace';
import type { ObservationReadPort } from '../relayed-observations';
import type { SnapshotReadPort } from '../stored-snapshot';
import { createInMemoryRuntime, FIXTURE_OPERATOR_DIRECTORY } from './in-memory-runtime';

/**
 * ADR-0069 deliverable 6c-2, the read half, exercised.
 *
 * ⚠️ WHAT THESE PROVE THAT NO OTHER SPEC DOES: that the only operation reading
 * TWO stores opens NEITHER before the scope is known, opens the second only
 * after the first answered, and 🛑 tells "AGE has no context, so nothing ran"
 * apart from "AGE ran and concluded nothing".
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
    capturedAt: '2026-01-02T00:00:00.000Z',
    snapshot: toScoredBifSnapshot(context),
  });
}

const OBSERVATION: StoredSourceObservation = {
  observationId: 'observation-fictional-1',
  organizationId: 'org-fictional-1',
  sourceSystem: 'example-visibility-system',
  sourceInstance: 'instance-fictional-1',
  sourceRecordId: 'record-fictional-1',
  subject: { kind: 'unmapped', topicLabel: 'kite sentiment' },
  claim: { direction: 'down', materiality: 'moderate' },
  period: {
    observedAt: '2026-07-31T00:00:00.000Z',
    windowStart: '2026-07-01T00:00:00.000Z',
    windowEnd: '2026-07-31T00:00:00.000Z',
  },
  claimKind: 'raw-observation',
  recordedAt: '2026-08-05T00:00:00.000Z',
};

/**
 * ⚠️ HANDLES ARE COUNTED, 🚫 NOT INFERRED FROM OUTPUT. A run that must not reach
 * a store is proved by the store never having been opened — an assertion on the
 * message it printed would still pass if the connection had been opened first.
 */
interface Harness {
  readonly openContext: () => SnapshotReadPort;
  readonly openObservations: () => ObservationReadPort;
  readonly opened: string[];
  readonly calls: string[];
}

function harness(
  record: ScoredBifSnapshotRecord | null,
  observations: readonly StoredSourceObservation[],
  options: { readonly observationsThrow?: boolean } = {},
): Harness {
  const opened: string[] = [];
  const calls: string[] = [];

  return {
    opened,
    calls,
    openContext: () => {
      opened.push('context');
      return {
        findLatest: async (key) => {
          calls.push(`findLatest:${key.organizationId}:${key.bifId}`);
          return record;
        },
        close: async () => {
          calls.push('close:context');
        },
      };
    },
    openObservations: () => {
      opened.push('observations');
      return {
        listForOrganization: async (organizationId) => {
          calls.push(`listForOrganization:${organizationId}`);
          if (options.observationsThrow === true) {
            throw new Error('one row failed validation.');
          }
          return observations;
        },
        close: async () => {
          calls.push('close:observations');
        },
      };
    },
  };
}

function configuredRuntime() {
  const runtime = createInMemoryRuntime(CONFIGURED);
  createClientRecord(runtime, DRAFT);
  return runtime;
}

describe('🛑 the order between the two stores', () => {
  it('reads the CONTEXT first, then the observations, in the DERIVED scope', async () => {
    const bench = harness(storedRecord(), [OBSERVATION]);

    const outcome = await readDerivedIntelligence(
      configuredRuntime(),
      bench.openContext,
      bench.openObservations,
      'org-fictional-1',
      'fictional-client-1',
      'bif-fictional',
    );

    expect(outcome.kind).toBe('derived');
    expect(bench.opened).toEqual(['context', 'observations']);
    // ⚠️ The organization was never typed: it came off the client record.
    expect(bench.calls).toEqual([
      'findLatest:org-fictional-1:bif-fictional',
      'close:context',
      'listForOrganization:org-fictional-1',
      'close:observations',
    ]);
  });

  it('🛑 an unknown business opens NEITHER connection', async () => {
    const bench = harness(storedRecord(), [OBSERVATION]);

    const outcome = await readDerivedIntelligence(
      configuredRuntime(),
      bench.openContext,
      bench.openObservations,
      'org-fictional-1',
      'fictional-client-nobody',
      'bif-fictional',
    );

    expect(outcome.kind).toBe('refused');
    expect(bench.opened).toEqual([]);
  });

  it('🛑 a blank BIF id refuses before any connection — 🚫 it is never defaulted', async () => {
    const bench = harness(storedRecord(), [OBSERVATION]);

    const outcome = await readDerivedIntelligence(
      configuredRuntime(),
      bench.openContext,
      bench.openObservations,
      'org-fictional-1',
      'fictional-client-1',
      '   ',
    );

    expect(outcome.kind).toBe('refused');
    if (outcome.kind === 'refused') expect(outcome.reason).toContain('cannot derive it');
    expect(bench.opened).toEqual([]);
  });
});

describe('🛑 never run is not the same as concluded nothing', () => {
  it('reports NO CONTEXT as its own outcome, and never opens the observation store', async () => {
    const bench = harness(null, [OBSERVATION]);

    const outcome = await readDerivedIntelligence(
      configuredRuntime(),
      bench.openContext,
      bench.openObservations,
      'org-fictional-1',
      'fictional-client-1',
      'bif-fictional',
    );

    expect(outcome.kind).toBe('no-context');
    if (outcome.kind === 'no-context') {
      expect(outcome.reason).toContain('never ran at all');
      expect(outcome.reason).toContain('neither is a statement about the business');
      for (const forbidden of ['no issues', 'no problems', 'healthy', 'all clear']) {
        expect(outcome.reason.toLowerCase(), forbidden).not.toContain(forbidden);
      }
    }
    // 🛑 The store AGE could not have interpreted an answer from is never asked.
    expect(bench.opened).toEqual(['context']);
  });

  it('🛑 NO OBSERVATIONS still derives — the projection names what nobody reported on', async () => {
    const bench = harness(storedRecord(), []);

    const outcome = await readDerivedIntelligence(
      configuredRuntime(),
      bench.openContext,
      bench.openObservations,
      'org-fictional-1',
      'fictional-client-1',
      'bif-fictional',
    );

    expect(outcome.kind).toBe('derived');
    if (outcome.kind === 'derived') {
      expect(outcome.view.conclusions).toEqual([]);
      // 🚫 An empty list must never be read as a clean bill.
      expect(outcome.view.nothingConcludedNotice).toContain('not "no issues found"');
      expect(outcome.view.persistenceNotice).toContain('does not store conclusions');
    }
    expect(bench.opened).toEqual(['context', 'observations']);
  });
});

describe('⚠️ what a fault must never become', () => {
  it('refuses the WHOLE read when one observation row will not read back', async () => {
    const bench = harness(storedRecord(), [OBSERVATION], { observationsThrow: true });

    const outcome = await readDerivedIntelligence(
      configuredRuntime(),
      bench.openContext,
      bench.openObservations,
      'org-fictional-1',
      'fictional-client-1',
      'bif-fictional',
    );

    expect(outcome.kind).toBe('refused');
    if (outcome.kind === 'refused') {
      expect(outcome.reason).toContain('part of the evidence');
    }
    // ⚠️ Released even though the read threw.
    expect(bench.calls).toContain('close:observations');
  });

  it('names a deployment fault as one, 🚫 without a connection string', async () => {
    const outcome = await readDerivedIntelligence(
      configuredRuntime(),
      () => {
        throw new Error('AGE_CAPTURE_DATABASE_URL is not set.');
      },
      harness(null, []).openObservations,
      'org-fictional-1',
      'fictional-client-1',
      'bif-fictional',
    );

    expect(outcome.kind).toBe('refused');
    if (outcome.kind === 'refused') {
      expect(outcome.reason).toContain('AGE_CAPTURE_DATABASE_URL');
      expect(outcome.reason).not.toContain('postgres://');
    }
  });

  it('🚫 carries an observation AGE cannot relate rather than dropping it', async () => {
    const bench = harness(storedRecord(), [OBSERVATION]);

    const outcome = await readDerivedIntelligence(
      configuredRuntime(),
      bench.openContext,
      bench.openObservations,
      'org-fictional-1',
      'fictional-client-1',
      'bif-fictional',
    );

    expect(outcome.kind).toBe('derived');
    if (outcome.kind === 'derived') {
      expect(outcome.view.unrelated).toHaveLength(1);
      expect(outcome.view.unrelated[0]?.sourceSystem).toBe('example-visibility-system');
    }
  });
});
