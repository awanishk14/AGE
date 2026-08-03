import type { ClientRecord } from '@age/client-registry';
import { describe, expect, it } from 'vitest';

import { countBusinesses, groupIntoOrganizationBands, presentBusinesses } from './businesses-view';

/**
 * ⚠️ Obviously fictional, and it stays that way. 🚫 Real client names and
 * external account ids never enter the repository (ADR-0053 D3) — the
 * obviousness IS the guard, so nothing here is made "more realistic".
 */
const record = (clientId: string, organizationId: string): ClientRecord =>
  Object.freeze({
    clientId,
    organizationId,
    displayName: `Fictional ${clientId}`,
    externalRefs: {},
  });

describe('presentBusinesses', () => {
  it('reports NONE for an empty read, not an empty list', () => {
    // ⚠️ "AGE looked and there is nothing" — a result. It must be reachable
    // separately from "AGE has not looked".
    expect(presentBusinesses([])).toEqual({ kind: 'none' });
  });

  it('lists businesses in derived organization bands', () => {
    const view = presentBusinesses([record('c-2', 'org-b'), record('c-1', 'org-a')]);

    expect(view).toEqual({
      kind: 'listed',
      bands: [
        { organizationId: 'org-a', clients: [record('c-1', 'org-a')] },
        { organizationId: 'org-b', clients: [record('c-2', 'org-b')] },
      ],
    });
  });
});

describe('groupIntoOrganizationBands', () => {
  it('puts every record in exactly one band and drops none', () => {
    const records = [
      record('c-3', 'org-a'),
      record('c-1', 'org-b'),
      record('c-2', 'org-a'),
      record('c-4', 'org-b'),
    ];

    const bands = groupIntoOrganizationBands(records);

    const placed = bands.flatMap((band) => band.clients.map((client) => client.clientId));
    expect(placed.slice().sort()).toEqual(['c-1', 'c-2', 'c-3', 'c-4']);
    expect(placed).toHaveLength(records.length);
    expect(bands).toHaveLength(2);
  });

  it('keeps every client under its OWN organizationId', () => {
    // ⚠️ The band is DERIVED from the record. A client must never be shown
    // under a band it does not belong to — that would be a mis-scoped display
    // of exactly the kind ADR-0058 exists to prevent reaching a write.
    const bands = groupIntoOrganizationBands([record('c-1', 'org-a'), record('c-2', 'org-b')]);

    for (const band of bands) {
      for (const client of band.clients) {
        expect(client.organizationId).toBe(band.organizationId);
      }
    }
  });

  it('orders bands and clients deterministically', () => {
    const bands = groupIntoOrganizationBands([
      record('z', 'org-z'),
      record('b', 'org-a'),
      record('a', 'org-a'),
    ]);

    expect(bands.map((band) => band.organizationId)).toEqual(['org-a', 'org-z']);
    expect(bands[0]?.clients.map((client) => client.clientId)).toEqual(['a', 'b']);
  });

  it('returns nothing for no records rather than an empty band', () => {
    expect(groupIntoOrganizationBands([])).toEqual([]);
  });
});

describe('countBusinesses', () => {
  it('is UNDEFINED when nothing was read', () => {
    // 🚫 Not zero. A zero here is a measured-looking number nobody measured.
    expect(countBusinesses({ kind: 'not-configured', variable: 'X' })).toBeUndefined();
    expect(countBusinesses({ kind: 'refused', reason: 'because' })).toBeUndefined();
  });

  it('is zero only when AGE actually looked and found none', () => {
    expect(countBusinesses({ kind: 'none' })).toBe(0);
  });

  it('counts across bands', () => {
    const view = presentBusinesses([
      record('c-1', 'org-a'),
      record('c-2', 'org-a'),
      record('c-3', 'org-b'),
    ]);

    expect(countBusinesses(view)).toBe(3);
  });
});
