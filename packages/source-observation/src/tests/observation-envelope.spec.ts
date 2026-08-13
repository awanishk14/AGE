import { describe, expect, it } from 'vitest';

import { acceptSourceObservationEnvelope } from '../observation-envelope';

/**
 * ⚠️ Every fixture here is OBVIOUSLY FICTIONAL. Obvious fictionality IS the
 * guard (ADR-0053 D3, ADR-0065 D1) — 🚫 do not "make these more realistic".
 */
const WELL_FORMED = Object.freeze({
  subject: { kind: 'modelled', subjectKind: 'service', label: 'Widget Polishing' },
  claim: { direction: 'down', materiality: 'substantial' },
  period: {
    observedAt: '2026-07-31',
    windowStart: '2026-07-01',
    windowEnd: '2026-07-31',
  },
  provenance: {
    sourceSystem: 'example-seo-system',
    sourceInstance: 'instance-fictional-1',
    sourceRecordId: 'record-fictional-1',
    organizationScope: 'org-fictional-1',
  },
  claimKind: 'raw-observation',
});

type Mutable = Record<string, unknown>;

function clone(): Mutable {
  return structuredClone(WELL_FORMED) as unknown as Mutable;
}

/** Walks to the parent of `path`, so a test can delete or overwrite one leaf. */
function parentOf(root: Mutable, path: readonly string[]): Mutable {
  let cursor = root;
  for (const segment of path.slice(0, -1)) {
    cursor = cursor[segment] as Mutable;
  }
  return cursor;
}

function leafOf(path: readonly string[]): string {
  const leaf = path[path.length - 1];
  if (leaf === undefined) throw new Error('a mutation path must name a leaf');
  return leaf;
}

function withoutPath(path: readonly string[]): unknown {
  const root = clone();
  delete parentOf(root, path)[leafOf(path)];
  return root;
}

function withValueAt(path: readonly string[], value: unknown): unknown {
  const root = clone();
  parentOf(root, path)[leafOf(path)] = value;
  return root;
}

describe('acceptSourceObservationEnvelope treats its input as untrusted', () => {
  it('accepts a well-formed envelope and changes nothing about it', () => {
    const result = acceptSourceObservationEnvelope(structuredClone(WELL_FORMED));

    expect(result.outcome).toBe('accepted');
    if (result.outcome !== 'accepted') return;
    expect(result.envelope).toEqual(WELL_FORMED);
  });

  it.each([
    ['not-an-object', undefined, 'envelope'],
    ['not-an-object', null, 'envelope'],
    ['not-an-object', 'a string', 'envelope'],
    ['not-an-object', [WELL_FORMED], 'envelope'],
  ] as const)('refuses %s input, naming the position', (reason, input, position) => {
    const result = acceptSourceObservationEnvelope(input);

    expect(result).toEqual({ outcome: 'refused', reason, position });
  });

  it.each([
    [['subject', 'kind'], 'subject.kind'],
    [['subject', 'label'], 'subject.label'],
    [['claim', 'direction'], 'claim.direction'],
    [['claim', 'materiality'], 'claim.materiality'],
    [['period', 'observedAt'], 'period.observedAt'],
    [['period', 'windowStart'], 'period.windowStart'],
    [['period', 'windowEnd'], 'period.windowEnd'],
    [['provenance', 'sourceSystem'], 'provenance.sourceSystem'],
    [['provenance', 'sourceInstance'], 'provenance.sourceInstance'],
    [['provenance', 'sourceRecordId'], 'provenance.sourceRecordId'],
    [['provenance', 'organizationScope'], 'provenance.organizationScope'],
    [['claimKind'], 'claimKind'],
  ] as const)('refuses a missing %s rather than defaulting it', (path, position) => {
    const result = acceptSourceObservationEnvelope(withoutPath(path));

    expect(result).toEqual({ outcome: 'refused', reason: 'missing-field', position });
  });

  it('refuses a blank string rather than treating it as a value', () => {
    expect(
      acceptSourceObservationEnvelope(withValueAt(['provenance', 'sourceInstance'], '   ')),
    ).toEqual({
      outcome: 'refused',
      reason: 'blank-field',
      position: 'provenance.sourceInstance',
    });
  });

  it.each([
    [['claim', 'direction'], 'improved'],
    [['claim', 'materiality'], 'huge'],
    [['subject', 'subjectKind'], 'keyword'],
  ] as const)('refuses an unrecognised %s', (path, value) => {
    const position = path.join('.');

    expect(acceptSourceObservationEnvelope(withValueAt(path, value))).toEqual({
      outcome: 'refused',
      reason: 'unrecognised-value',
      position,
    });
  });

  it('refuses an unrecognised claimKind — the two are never merged', () => {
    expect(acceptSourceObservationEnvelope(withValueAt(['claimKind'], 'derived'))).toEqual({
      outcome: 'refused',
      reason: 'unrecognised-value',
      position: 'claimKind',
    });
  });

  it('refuses an unparseable instant rather than repairing it', () => {
    expect(
      acceptSourceObservationEnvelope(withValueAt(['period', 'observedAt'], 'last July')),
    ).toEqual({
      outcome: 'refused',
      reason: 'unparseable-instant',
      position: 'period.observedAt',
    });
  });

  it('refuses an inverted window rather than swapping the ends', () => {
    const root = clone();
    const period = root.period as Mutable;
    period.windowStart = '2026-08-31';
    period.windowEnd = '2026-08-01';

    expect(acceptSourceObservationEnvelope(root)).toEqual({
      outcome: 'refused',
      reason: 'inverted-window',
      position: 'period.windowStart',
    });
  });

  it('accepts an unmapped subject, and does NOT infer a subjectKind for it', () => {
    const result = acceptSourceObservationEnvelope(
      withValueAt(['subject'], { kind: 'unmapped', topicLabel: 'fictional emerging topic' }),
    );

    expect(result.outcome).toBe('accepted');
    if (result.outcome !== 'accepted') return;
    expect(result.envelope.subject).toEqual({
      kind: 'unmapped',
      topicLabel: 'fictional emerging topic',
    });
    expect(result.envelope.subject).not.toHaveProperty('subjectKind');
  });

  it('a refusal never carries the value it rejected', () => {
    const secret = 'a-value-that-must-not-travel';

    const result = acceptSourceObservationEnvelope(withValueAt(['claim', 'direction'], secret));

    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('a refusal never carries the organisation scope', () => {
    const result = acceptSourceObservationEnvelope(withoutPath(['claim', 'direction']));

    expect(JSON.stringify(result)).not.toContain(WELL_FORMED.provenance.organizationScope);
  });
});
