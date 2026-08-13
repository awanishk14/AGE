/**
 * The five-part envelope, and its acceptance from UNTRUSTED input.
 *
 * ⚠️ `acceptSourceObservationEnvelope` takes `unknown` on purpose. Everything
 * arriving here came from outside AGE — a peer product, relayed by an operator —
 * and 🚫 nothing about it is believed until it has been checked. It **defaults
 * nothing, generates nothing and infers nothing**: a missing field is a refusal
 * naming its POSITION, 🚫 never a field filled in helpfully.
 *
 * 🛑 A REFUSAL NAMES A POSITION AND NOTHING ELSE. 🚫 Never the value it rejected,
 * never the organisation, never another client's id — the refusal is read by
 * whoever relayed the observation, and it must not become a way to ask AGE
 * questions about data the asker has not been entitled to.
 *
 * Pure: no clock, no ids, no randomness, no I/O.
 */

import { type ObservationClaim, CLAIM_DIRECTIONS, MATERIALITY_BANDS } from './observation-claim';
import { type ObservationPeriod, isParseableInstant, isWindowOrdered } from './observation-period';
import {
  type ClaimKind,
  type ObservationProvenance,
  CLAIM_KINDS,
  PROVENANCE_FIELDS,
} from './observation-provenance';
import {
  type ObservationSubject,
  type ObservationSubjectKind,
  OBSERVATION_SUBJECT_KINDS,
} from './observation-subject';

export interface SourceObservationEnvelope {
  readonly subject: ObservationSubject;
  readonly claim: ObservationClaim;
  readonly period: ObservationPeriod;
  readonly provenance: ObservationProvenance;
  readonly claimKind: ClaimKind;
}

/**
 * ⚠️ Every refusal is one of these, and each names the POSITION at fault.
 * 🚫 There is no `other` arm and no free-text reason: a free-text reason is where
 * a value leaks into a message that a refused caller gets to read.
 */
export interface EnvelopeRefusal {
  readonly outcome: 'refused';
  readonly reason:
    | 'not-an-object'
    | 'missing-field'
    | 'unrecognised-value'
    | 'blank-field'
    | 'unparseable-instant'
    | 'inverted-window';
  /** A dotted path, e.g. `provenance.sourceInstance`. 🚫 Never a value. */
  readonly position: string;
}

export interface EnvelopeAccepted {
  readonly outcome: 'accepted';
  readonly envelope: SourceObservationEnvelope;
}

export type EnvelopeAcceptance = EnvelopeAccepted | EnvelopeRefusal;

function refuse(reason: EnvelopeRefusal['reason'], position: string): EnvelopeRefusal {
  return { outcome: 'refused', reason, position };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A present, non-blank string — 🚫 a blank string is never a value. */
function readRequiredString(
  source: Record<string, unknown>,
  key: string,
  position: string,
): string | EnvelopeRefusal {
  const value = source[key];
  if (value === undefined || value === null) return refuse('missing-field', position);
  if (typeof value !== 'string') return refuse('unrecognised-value', position);
  if (value.trim().length === 0) return refuse('blank-field', position);
  return value;
}

function isRefusal(value: unknown): value is EnvelopeRefusal {
  return isRecord(value) && value.outcome === 'refused';
}

function readSubject(input: unknown): ObservationSubject | EnvelopeRefusal {
  if (!isRecord(input)) return refuse('not-an-object', 'subject');

  const kind = input.kind;
  if (kind === undefined || kind === null) return refuse('missing-field', 'subject.kind');

  if (kind === 'unmapped') {
    const topicLabel = readRequiredString(input, 'topicLabel', 'subject.topicLabel');
    if (isRefusal(topicLabel)) return topicLabel;
    return { kind: 'unmapped', topicLabel };
  }

  if (kind === 'modelled') {
    const subjectKind = input.subjectKind;
    if (subjectKind === undefined || subjectKind === null) {
      return refuse('missing-field', 'subject.subjectKind');
    }
    if (!OBSERVATION_SUBJECT_KINDS.includes(subjectKind as ObservationSubjectKind)) {
      return refuse('unrecognised-value', 'subject.subjectKind');
    }
    const label = readRequiredString(input, 'label', 'subject.label');
    if (isRefusal(label)) return label;
    return { kind: 'modelled', subjectKind: subjectKind as ObservationSubjectKind, label };
  }

  return refuse('unrecognised-value', 'subject.kind');
}

function readClaim(input: unknown): ObservationClaim | EnvelopeRefusal {
  if (!isRecord(input)) return refuse('not-an-object', 'claim');

  const { direction, materiality } = input;
  if (direction === undefined || direction === null) {
    return refuse('missing-field', 'claim.direction');
  }
  if (!CLAIM_DIRECTIONS.includes(direction as ObservationClaim['direction'])) {
    return refuse('unrecognised-value', 'claim.direction');
  }
  if (materiality === undefined || materiality === null) {
    return refuse('missing-field', 'claim.materiality');
  }
  if (!MATERIALITY_BANDS.includes(materiality as ObservationClaim['materiality'])) {
    return refuse('unrecognised-value', 'claim.materiality');
  }

  return {
    direction: direction as ObservationClaim['direction'],
    materiality: materiality as ObservationClaim['materiality'],
  };
}

function readPeriod(input: unknown): ObservationPeriod | EnvelopeRefusal {
  if (!isRecord(input)) return refuse('not-an-object', 'period');

  function readInstant(field: keyof ObservationPeriod): string | EnvelopeRefusal {
    const value = readRequiredString(input as Record<string, unknown>, field, `period.${field}`);
    if (isRefusal(value)) return value;
    if (!isParseableInstant(value)) return refuse('unparseable-instant', `period.${field}`);
    return value;
  }

  const observedAt = readInstant('observedAt');
  if (isRefusal(observedAt)) return observedAt;
  const windowStart = readInstant('windowStart');
  if (isRefusal(windowStart)) return windowStart;
  const windowEnd = readInstant('windowEnd');
  if (isRefusal(windowEnd)) return windowEnd;

  const period: ObservationPeriod = { observedAt, windowStart, windowEnd };

  if (!isWindowOrdered(period)) return refuse('inverted-window', 'period.windowStart');

  return period;
}

function readProvenance(input: unknown): ObservationProvenance | EnvelopeRefusal {
  if (!isRecord(input)) return refuse('not-an-object', 'provenance');

  // ⚠️ PROVENANCE_FIELDS fixes the ORDER in which positions are reported, so a
  // relayer fixing several omissions is told about them in a stable sequence.
  for (const field of PROVENANCE_FIELDS) {
    const value = readRequiredString(input, field, `provenance.${field}`);
    if (isRefusal(value)) return value;
  }

  return {
    sourceSystem: input.sourceSystem as string,
    sourceInstance: input.sourceInstance as string,
    sourceRecordId: input.sourceRecordId as string,
    organizationScope: input.organizationScope as string,
  };
}

/**
 * The only way to obtain a `SourceObservationEnvelope`.
 *
 * 🚫 There is deliberately no constructor, no builder with defaults and no
 * partial variant. If a second way to make one appears, the checks in this
 * module become optional — and the copy that gets relaxed still passes its own
 * tests.
 */
export function acceptSourceObservationEnvelope(input: unknown): EnvelopeAcceptance {
  if (!isRecord(input)) return refuse('not-an-object', 'envelope');

  const subject = readSubject(input.subject);
  if (isRefusal(subject)) return subject;

  const claim = readClaim(input.claim);
  if (isRefusal(claim)) return claim;

  const period = readPeriod(input.period);
  if (isRefusal(period)) return period;

  const provenance = readProvenance(input.provenance);
  if (isRefusal(provenance)) return provenance;

  const claimKind = input.claimKind;
  if (claimKind === undefined || claimKind === null) {
    return refuse('missing-field', 'claimKind');
  }
  if (!CLAIM_KINDS.includes(claimKind as ClaimKind)) {
    return refuse('unrecognised-value', 'claimKind');
  }

  return {
    outcome: 'accepted',
    envelope: { subject, claim, period, provenance, claimKind: claimKind as ClaimKind },
  };
}
