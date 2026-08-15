import { join } from 'node:path';

import type { StoredSourceObservation } from '@age/source-observation';
import { describe, expect, it } from 'vitest';

import { createClientRecord } from '../operator-workspace';
import {
  NONE_RELAYED_REASON,
  narrowObservationRead,
  readRelayedObservations,
  type ObservationReadPort,
} from '../relayed-observations';
import { createInMemoryRuntime, FIXTURE_OPERATOR_DIRECTORY } from './in-memory-runtime';

/**
 * ADR-0069, the read half, exercised.
 *
 * ⚠️ WHAT THESE PROVE THAT NO OTHER SPEC DOES: that reading what peers observed
 * cannot write, cannot reach a database before the scope is known, and 🚫 never
 * renders "nothing has been relayed" as "nothing is happening".
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

const OBSERVATION: StoredSourceObservation = {
  observationId: 'observation-fictional-1',
  organizationId: 'org-fictional-1',
  sourceSystem: 'example-visibility-system',
  sourceInstance: 'instance-fictional-1',
  sourceRecordId: 'record-fictional-1',
  subject: { kind: 'modelled', subjectKind: 'service', label: 'Widget Polishing' },
  claim: { direction: 'down', materiality: 'moderate' },
  period: {
    observedAt: '2026-07-31T00:00:00.000Z',
    windowStart: '2026-07-01T00:00:00.000Z',
    windowEnd: '2026-07-31T00:00:00.000Z',
  },
  claimKind: 'raw-observation',
  recordedAt: '2026-08-05T00:00:00.000Z',
};

interface PortLog {
  readonly port: ObservationReadPort;
  readonly calls: string[];
}

function portReturning(observations: readonly StoredSourceObservation[]): PortLog {
  const calls: string[] = [];

  return {
    calls,
    port: {
      listForOrganization: async (organizationId) => {
        calls.push(`listForOrganization:${organizationId}`);
        return observations;
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

describe('readRelayedObservations', () => {
  it('reads in the scope it DERIVED from the client record', async () => {
    const runtime = configuredRuntime();
    const { port, calls } = portReturning([OBSERVATION]);

    const outcome = await readRelayedObservations(
      runtime,
      () => port,
      'org-fictional-1',
      'fictional-client-1',
    );

    expect(outcome.kind).toBe('read');
    if (outcome.kind === 'read') {
      expect(outcome.organizationId).toBe('org-fictional-1');
      // ⚠️ Carried through UNCHANGED: 🚫 not ranked, 🚫 not scored, 🚫 not deduped.
      expect(outcome.observations).toEqual([OBSERVATION]);
    }

    // ⚠️ The organization was never typed: it came off the record.
    expect(calls).toEqual(['listForOrganization:org-fictional-1', 'close']);
  });

  it('🛑 an empty answer is a NAMED state about the relay, 🚫 not about the business', async () => {
    const runtime = configuredRuntime();
    const outcome = await readRelayedObservations(
      runtime,
      () => portReturning([]).port,
      'org-fictional-1',
      'fictional-client-1',
    );

    expect(outcome.kind).toBe('none-relayed');
    if (outcome.kind === 'none-relayed') {
      expect(outcome.reason).toBe(NONE_RELAYED_REASON);
      // 🛑 The distinction the operator was promised, in the sentence itself.
      expect(outcome.reason).toContain('did not run');
      expect(outcome.reason).toContain('ran and found nothing');
      expect(outcome.reason).toContain('nothing is implied');
      // 🚫 Never a clean bill of health.
      for (const forbidden of ['no issues', 'no problems', 'healthy', 'all clear']) {
        expect(outcome.reason.toLowerCase(), forbidden).not.toContain(forbidden);
      }
    }
  });

  it('releases the connection even when the read throws, and shows NOTHING in part', async () => {
    const runtime = configuredRuntime();
    const calls: string[] = [];
    const port: ObservationReadPort = {
      listForOrganization: async () => {
        calls.push('listForOrganization');
        throw new Error('A stored observation row is unreadable: `subjectLabel` must be present.');
      },
      close: async () => {
        calls.push('close');
      },
    };

    const outcome = await readRelayedObservations(
      runtime,
      () => port,
      'org-fictional-1',
      'fictional-client-1',
    );

    expect(outcome.kind).toBe('refused');
    if (outcome.kind === 'refused') {
      expect(outcome.reason).toContain('not a row AGE can report on in part');
    }
    expect(calls).toEqual(['listForOrganization', 'close']);
  });

  it('🛑 a refusal is NEVER an empty list — the two are different answers', async () => {
    const runtime = configuredRuntime();
    const outcome = await readRelayedObservations(
      runtime,
      () => {
        throw new Error('AGE_CAPTURE_DATABASE_URL is not set.');
      },
      'org-fictional-1',
      'fictional-client-1',
    );

    expect(outcome.kind).toBe('refused');
    // 🚫 A fault must not be reachable through the `read` arm at all.
    expect(JSON.stringify(outcome)).not.toContain('observations');
  });

  it('opens NO connection for a business it cannot resolve', async () => {
    const runtime = configuredRuntime();
    let opened = 0;

    const outcome = await readRelayedObservations(
      runtime,
      () => {
        opened += 1;
        return portReturning([]).port;
      },
      'org-fictional-1',
      'fictional-client-absent',
    );

    // ⚠️ Order is load-bearing: an unknown business must cost nothing and reach
    // nothing.
    expect(opened).toBe(0);
    expect(outcome.kind).toBe('refused');
    if (outcome.kind === 'refused') {
      expect(outcome.reason).toContain('not in the client record file');
    }
  });

  it('opens NO connection when nothing has been configured', async () => {
    let opened = 0;

    const outcome = await readRelayedObservations(
      createInMemoryRuntime({}),
      () => {
        opened += 1;
        return portReturning([]).port;
      },
      'org-fictional-1',
      'fictional-client-1',
    );

    expect(opened).toBe(0);
    expect(outcome.kind).toBe('not-configured');
  });
});

describe('🚫 the read port cannot become a write port', () => {
  it('narrows to exactly two members, 🚫 rebinding rather than spreading', async () => {
    const calls: string[] = [];
    const wider = {
      listForOrganization: async (organizationId: string) => {
        calls.push(`list:${organizationId}`);
        return [] as readonly StoredSourceObservation[];
      },
      close: async () => {
        calls.push('close');
      },
      // 🛑 The method that must not survive narrowing.
      append: async () => {
        calls.push('append');
      },
    };

    const narrowed = narrowObservationRead(wider);

    expect(Object.keys(narrowed).sort()).toEqual(['close', 'listForOrganization']);
    expect('append' in narrowed).toBe(false);

    await narrowed.listForOrganization('org-fictional-1');
    await narrowed.close();
    expect(calls).toEqual(['list:org-fictional-1', 'close']);
  });
});
