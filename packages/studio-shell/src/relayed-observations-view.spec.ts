import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { StoredSourceObservation } from '@age/source-observation';

import {
  presentRelayedObservations,
  RELAY_ARRIVAL_NOTICE,
  RELAY_SILENCE_NOTICE,
  RELAY_UNMAPPED_NOTICE,
} from './relayed-observations-view';

/**
 * ⚠️ Fixtures are OBVIOUSLY FICTIONAL, and that is the guard (ADR-0053 D3,
 * ADR-0065 D1). 🚫 No real client, no real peer-product instance, no real
 * organisation id — not even redacted.
 */
const observation = (
  overrides: Partial<StoredSourceObservation> = {},
): StoredSourceObservation => ({
  observationId: 'obs-fixture-1',
  organizationId: 'org-fixture',
  sourceSystem: 'fixture-rank-system',
  sourceInstance: 'fixture-instance-a',
  sourceRecordId: 'fixture-record-1',
  subject: { kind: 'modelled', subjectKind: 'service', label: 'Fictional Service' },
  claim: { direction: 'up', materiality: 'moderate' },
  period: {
    observedAt: '2026-05-04T00:00:00.000Z',
    windowStart: '2026-04-01T00:00:00.000Z',
    windowEnd: '2026-05-01T00:00:00.000Z',
  },
  claimKind: 'raw-observation',
  recordedAt: '2026-05-20T00:00:00.000Z',
  ...overrides,
});

describe('presentRelayedObservations', () => {
  it('groups by source system without ranking them', () => {
    const view = presentRelayedObservations('org-fixture', [
      observation({ observationId: 'a', sourceSystem: 'fixture-rank-system' }),
      observation({ observationId: 'b', sourceSystem: 'fixture-content-system' }),
      observation({ observationId: 'c', sourceSystem: 'fixture-rank-system' }),
    ]);

    // ⚠️ FIRST-APPEARANCE ORDER, preserving the read's ordering. 🚫 Not sorted
    // by count: ordering source systems by how much each relayed would rank
    // them, and a source that relayed more is not a better source.
    expect(view.sourceSystems.map((system) => system.sourceSystem)).toEqual([
      'fixture-rank-system',
      'fixture-content-system',
    ]);
    expect(view.sourceSystems[0]!.relayedCount).toBe(2);
    expect(view.sourceSystemCount).toBe(2);
    expect(view.observationCount).toBe(3);
  });

  it('carries the silence notice even when observations exist', () => {
    // 🛑 THE HARDEST THING THIS SCREEN HAS TO DO. The reasoning does not change
    // when the list is non-empty: a source system that is absent has not been
    // relayed, and "never connected" / "did not run" / "ran and found nothing"
    // stay indistinguishable from AGE's side.
    const view = presentRelayedObservations('org-fixture', [observation()]);

    expect(view.silenceNotice).toBe(RELAY_SILENCE_NOTICE);
    expect(view.silenceNotice).toContain('may not have run');
    expect(view.silenceNotice).toContain('run and found nothing');
  });

  it('says arrival is not confirmation', () => {
    const view = presentRelayedObservations('org-fixture', [observation()]);

    expect(view.arrivalNotice).toBe(RELAY_ARRIVAL_NOTICE);
    expect(view.arrivalNotice).toContain('not being confirmed');
    expect(view.arrivalNotice).toContain('change no score');
  });

  it('renders an empty relay as an empty relay and nothing more', () => {
    const view = presentRelayedObservations('org-fixture', []);

    expect(view.sourceSystems).toEqual([]);
    expect(view.observationCount).toBe(0);
    expect(view.silenceNotice).toBe(RELAY_SILENCE_NOTICE);
    // 🚫 NO EXPECTED-PEER-PRODUCT LIST. A named product with a zero beside it
    // would assert that the product has nothing — the one claim AGE cannot make.
    expect(JSON.stringify(view)).not.toMatch(/RankOps|SNARA|Humantik|mcp-ads/i);
  });

  it('shows an unmapped subject as unmapped, never as coverage', () => {
    const view = presentRelayedObservations('org-fixture', [
      observation({ subject: { kind: 'unmapped', topicLabel: 'Fictional Unknown Topic' } }),
    ]);

    const [entry] = view.sourceSystems[0]!.observations;

    expect(entry!.subjectState).toBe('unmapped');
    expect(entry!.subject).toBe('Fictional Unknown Topic');
    expect(entry!.subjectDetail).toContain('does not model this subject');
    expect(view.unmappedNotice).toBe(RELAY_UNMAPPED_NOTICE);
  });

  it('omits the unmapped notice when every subject is modelled', () => {
    const view = presentRelayedObservations('org-fixture', [observation()]);

    expect(view.unmappedNotice).toBeUndefined();
    expect(view.sourceSystems[0]!.observations[0]!.subjectState).toBe('modelled');
  });

  it('shows the observed instant and the relayed instant separately', () => {
    // ⚠️ An operator-mediated relay records days after the fact BY
    // CONSTRUCTION. One date would make a stale observation look fresh.
    const entry = presentRelayedObservations('org-fixture', [observation()]).sourceSystems[0]!
      .observations[0]!;

    expect(entry.observedAt).toBe('2026-05-04T00:00:00.000Z');
    expect(entry.relayedAt).toBe('2026-05-20T00:00:00.000Z');
    expect(entry.observedAt).not.toBe(entry.relayedAt);
    expect(entry.window).toBe('2026-04-01T00:00:00.000Z → 2026-05-01T00:00:00.000Z');
  });

  it('reports the claim as reported and reaches no conclusion', () => {
    const entry = presentRelayedObservations('org-fixture', [
      observation({ claim: { direction: 'down', materiality: 'substantial' } }),
    ]).sourceSystems[0]!.observations[0]!;

    expect(entry.claim).toBe('down · substantial');
    // 🚫 NOTHING SCORES HERE. A conclusion is authored by a deterministic rule
    // in `@age/derived-intelligence` and by nothing else (ADR-0069 D1).
    expect(entry).not.toHaveProperty('score');
    expect(entry).not.toHaveProperty('confidence');
    expect(entry).not.toHaveProperty('verified');
  });

  it('echoes the organization scope the read ran under', () => {
    expect(presentRelayedObservations('org-fixture', []).organizationId).toBe('org-fixture');
  });

  it('is pure and branches on no named source system', () => {
    const source = readFileSync(new URL('./relayed-observations-view.ts', import.meta.url), 'utf8');

    // ⚠️ Strip comments first, or the module's own explanation of a rule
    // matches the scan for that rule.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    expect(code.length).toBeGreaterThan(500);

    for (const banned of [
      'new Date(',
      'Date.now(',
      'Math.random(',
      'fetch(',
      'node:fs',
      'process.env',
      '@prisma/client',
      '@age/persistence',
    ]) {
      expect(code).not.toContain(banned);
    }

    // 🚫 SOURCE-NEUTRAL BY SHAPE (ADR-0069 D6): `sourceSystem` is DATA, never a
    // branch. A hard-coded peer product here would make a sixth invisible.
    for (const product of ['RankOps', 'SNARA', 'Humantik', 'mcp-ads', 'Content Intelligence']) {
      expect(code).not.toContain(product);
    }
  });
});
