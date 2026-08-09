import { join } from 'node:path';

import {
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  buildProfileFromAnswers,
  normalizeScoredBifSnapshotRecord,
  produceScoredBifContext,
  toScoredBifSnapshot,
  type DiscoveryAnswer,
  type ScoredBifSnapshotRecord,
} from '@age/business-discovery-contracts';
import { describe, expect, it } from 'vitest';

import { createClientRecord } from '../operator-workspace';
import { narrowSnapshotRead, readStoredSnapshot, type SnapshotReadPort } from '../stored-snapshot';
import { createInMemoryRuntime, FIXTURE_OPERATOR_DIRECTORY } from './in-memory-runtime';
import { STATED_ANSWER_PROVENANCE } from '@age/business-discovery-contracts';

/**
 * ADR-0064, exercised.
 *
 * ⚠️ WHAT THESE PROVE THAT NO OTHER SPEC DOES: that the console's read of the
 * stored row cannot write, cannot reach a database before the scope is known,
 * and 🚫 never renders a miss, a fault or a corrupt row as an answer about the
 * business.
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

interface PortLog {
  readonly port: SnapshotReadPort;
  readonly calls: string[];
}

function portReturning(record: ScoredBifSnapshotRecord | null): PortLog {
  const calls: string[] = [];

  return {
    calls,
    port: {
      findLatest: async (key) => {
        calls.push(`findLatest:${key.clientId}/${key.organizationId}/${key.bifId}`);
        return record;
      },
      close: async () => {
        calls.push('close');
      },
    },
  };
}

function configuredRuntime() {
  const runtime = createInMemoryRuntime(CONFIGURED);
  createClientRecord(runtime, DRAFT);
  return runtime;
}

describe('readStoredSnapshot', () => {
  it('reads the latest row in the scope it DERIVED from the client record', async () => {
    const runtime = configuredRuntime();
    const { port, calls } = portReturning(storedRecord());

    const outcome = await readStoredSnapshot(
      runtime,
      () => port,
      'fictional-client-1',
      'bif-fictional',
    );

    expect(outcome.kind).toBe('found');
    if (outcome.kind === 'found') {
      expect(outcome.organizationId).toBe('org-fictional-1');
      expect(outcome.view.snapshotId).toBe('snapshot-fictional');
    }

    // ⚠️ The organization was never typed: it came off the record.
    expect(calls).toEqual(['findLatest:fictional-client-1/org-fictional-1/bif-fictional', 'close']);
  });

  it('releases the connection even when the read throws', async () => {
    const runtime = configuredRuntime();
    const calls: string[] = [];
    const port: SnapshotReadPort = {
      findLatest: async () => {
        calls.push('findLatest');
        throw new Error('snapshotVersion 9.0.0 is not readable by this build.');
      },
      close: async () => {
        calls.push('close');
      },
    };

    const outcome = await readStoredSnapshot(
      runtime,
      () => port,
      'fictional-client-1',
      'bif-fictional',
    );

    // 🚫 A row that failed validation is never rendered in part.
    expect(outcome.kind).toBe('refused');
    if (outcome.kind === 'refused') {
      expect(outcome.reason).toContain('not a row AGE can report on in part');
    }
    expect(calls).toEqual(['findLatest', 'close']);
  });

  it('reports a miss as a statement about the query, never about the business', async () => {
    const runtime = configuredRuntime();
    const { port } = portReturning(null);

    const outcome = await readStoredSnapshot(
      runtime,
      () => port,
      'fictional-client-1',
      'bif-nothing',
    );

    expect(outcome.kind).toBe('no-snapshot');
    if (outcome.kind === 'no-snapshot') {
      expect(outcome.reason).toContain('a statement about this query and not about the business');
      // 🚫 Never "no data", never a clean bill of health.
      expect(outcome.reason.toLowerCase()).not.toContain('no data');
      expect(outcome.reason).toContain('nothing is implied');
    }
  });

  it('opens NO connection for a business it cannot resolve', async () => {
    const runtime = configuredRuntime();
    let opened = 0;

    const outcome = await readStoredSnapshot(
      runtime,
      () => {
        opened += 1;
        return portReturning(null).port;
      },
      'fictional-client-absent',
      'bif-fictional',
    );

    // ⚠️ Order is load-bearing: an unknown business must cost nothing and reach
    // nothing.
    expect(opened).toBe(0);
    expect(outcome.kind).toBe('refused');
  });

  it('opens NO connection when nothing has been configured', async () => {
    const runtime = createInMemoryRuntime({});
    let opened = 0;

    const outcome = await readStoredSnapshot(
      runtime,
      () => {
        opened += 1;
        return portReturning(null).port;
      },
      'fictional-client-1',
      'bif-fictional',
    );

    expect(opened).toBe(0);
    expect(outcome.kind).toBe('not-configured');
  });

  it('refuses an empty BIF id rather than deriving or defaulting one', async () => {
    const runtime = configuredRuntime();
    let opened = 0;

    const outcome = await readStoredSnapshot(
      runtime,
      () => {
        opened += 1;
        return portReturning(null).port;
      },
      'fictional-client-1',
      '   ',
    );

    expect(opened).toBe(0);
    expect(outcome.kind).toBe('refused');
    if (outcome.kind === 'refused') {
      expect(outcome.reason).toContain('AGE cannot derive it');
    }
  });

  it('names a connection fault without crashing, and without a connection string', async () => {
    const runtime = configuredRuntime();

    const outcome = await readStoredSnapshot(
      runtime,
      () => {
        throw new Error('DATABASE_URL_APP is not set.');
      },
      'fictional-client-1',
      'bif-fictional',
    );

    expect(outcome.kind).toBe('refused');
    if (outcome.kind === 'refused') {
      expect(outcome.reason).toContain('DATABASE_URL_APP');
      // 🚫 A connection string carries a password. The message names the
      // variable, never its value.
      expect(outcome.reason).not.toContain('postgres://');
    }
  });
});

describe('narrowSnapshotRead', () => {
  /**
   * ⚠️ MADE TO FAIL BEFORE IT WAS TRUSTED: replacing the rebinding with a
   * spread makes this test name `findBySnapshotId`, which is exactly the method
   * whose absence ADR-0055 §5 item 1 depends on.
   */
  it('drops every method but the one read and the close', () => {
    const wider = {
      findLatest: async () => null,
      findBySnapshotId: async () => null,
      close: async () => {},
    };

    const narrowed = narrowSnapshotRead(wider);

    expect(Object.keys(narrowed).sort()).toEqual(['close', 'findLatest']);
    expect('findBySnapshotId' in narrowed).toBe(false);
  });

  it('still performs the read and the close it kept', async () => {
    const calls: string[] = [];
    const narrowed = narrowSnapshotRead({
      findLatest: async () => {
        calls.push('findLatest');
        return null;
      },
      close: async () => {
        calls.push('close');
      },
    });

    expect(await narrowed.findLatest({ clientId: 'c', organizationId: 'o', bifId: 'b' })).toBe(
      null,
    );
    await narrowed.close();

    expect(calls).toEqual(['findLatest', 'close']);
  });
});
