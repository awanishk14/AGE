import { ClientContext } from '@age/capability-kit';
import { describe, expect, it } from 'vitest';

import {
  findClientRecord,
  findExternalRef,
  parseClientRecord,
  toClientContext,
} from '../client-record';
import { FICTIONAL_CLIENT_RECORDS } from '../fixtures/fictional-clients';

const valid = {
  clientId: 'client-example-009',
  organizationId: 'org-example-009',
  displayName: 'Example Nine (fictional)',
  externalRefs: { rankops: 'rankops-example-009' },
};

describe('parseClientRecord', () => {
  it('accepts a well-formed record', () => {
    expect(parseClientRecord(valid).clientId).toBe('client-example-009');
  });

  it.each([
    ['clientId', { ...valid, clientId: '' }],
    ['organizationId', { ...valid, organizationId: '   ' }],
    ['displayName', { ...valid, displayName: '' }],
  ])('rejects an empty %s', (_label, value) => {
    expect(() => parseClientRecord(value)).toThrow();
  });

  it('rejects an unknown field rather than dropping it', () => {
    // .strict() — a typo'd or extra field is a mistake to surface, not to
    // silently discard, because a discarded scope field is invisible.
    expect(() => parseClientRecord({ ...valid, status: 'active' })).toThrow();
  });

  it('rejects an empty externalRefs value, so an unmapped system is absent rather than blank', () => {
    expect(() => parseClientRecord({ ...valid, externalRefs: { metaAds: '' } })).toThrow();
  });

  it('accepts any system key — the map is open, not an enum (ADR-0053 D2)', () => {
    const record = parseClientRecord({
      ...valid,
      externalRefs: { aToolInventedTomorrow: 'some-id' },
    });
    expect(findExternalRef(record, 'aToolInventedTomorrow')).toBe('some-id');
  });
});

describe('toClientContext', () => {
  it('produces the scoping context capabilities take, carrying both ids', () => {
    const context = toClientContext(parseClientRecord(valid));
    expect(context).toBeInstanceOf(ClientContext);
    expect(context.clientId).toBe('client-example-009');
    expect(context.organizationId).toBe('org-example-009');
  });

  it('never collapses the two ids — the scope stays two-field (ADR-0053 D6)', () => {
    const context = toClientContext(parseClientRecord(valid));
    expect(context.clientId).not.toBe(context.organizationId);
  });
});

describe('lookup', () => {
  it('finds a known record', () => {
    expect(findClientRecord(FICTIONAL_CLIENT_RECORDS, 'client-example-001')?.displayName).toContain(
      'Example Widgets',
    );
  });

  it('returns undefined for an unknown id and never invents a record', () => {
    expect(findClientRecord(FICTIONAL_CLIENT_RECORDS, 'client-nobody')).toBeUndefined();
  });

  it('distinguishes "not mapped" from "mapped to nothing"', () => {
    // The second fixture has no Meta ad account. A business without one is not
    // a business with an empty one (ADR-0026 D4 — absence is a limitation).
    const record = findClientRecord(FICTIONAL_CLIENT_RECORDS, 'client-example-002');
    expect(record).toBeDefined();
    expect(findExternalRef(record!, 'metaAds')).toBeUndefined();
    expect(findExternalRef(record!, 'rankops')).toBe('rankops-client-example-002');
  });
});
