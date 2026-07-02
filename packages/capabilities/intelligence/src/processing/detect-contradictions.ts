import { Polarity } from '@age/evidence-contracts';
import type { Evidence, EvidenceEntityLink } from '@age/evidence-contracts';

/**
 * detectContradictions — structural-only contradiction detection (ADR-0011).
 *
 * Two evidence records contradict each other when ALL of the following hold,
 * using only explicit fields already on the Evidence contract:
 *  - they link to the same entity (share at least one equal, defined
 *    EvidenceEntityLink field: organizationId, productId, competitorId, or
 *    marketId)
 *  - they carry the same `signalType`
 *  - each has an extractedSignal targeting the same `targetField`, with one
 *    signal's `polarity` POSITIVE and the other's NEGATIVE
 *
 * NEUTRAL never contradicts. No semantic/meaning inference is performed —
 * only equality/opposite comparisons on structured fields.
 *
 * Returns the set of evidenceIds that participate in at least one
 * contradiction. Being flagged here does not imply rejection (ADR-0011):
 * contradiction-flagged evidence may still be accepted.
 */
export function detectContradictions(evidenceList: readonly Evidence[]): ReadonlySet<string> {
  const contradicting = new Set<string>();

  for (let i = 0; i < evidenceList.length; i += 1) {
    for (let j = i + 1; j < evidenceList.length; j += 1) {
      const a = evidenceList[i];
      const b = evidenceList[j];

      if (a && b && contradicts(a, b)) {
        contradicting.add(a.id);
        contradicting.add(b.id);
      }
    }
  }

  return contradicting;
}

function contradicts(a: Evidence, b: Evidence): boolean {
  if (a.signalType !== b.signalType) {
    return false;
  }

  if (!sharesEntity(a.entityLinked, b.entityLinked)) {
    return false;
  }

  return a.extractedSignals.some((signalA) =>
    b.extractedSignals.some((signalB) => isOpposingSignal(signalA, signalB)),
  );
}

function isOpposingSignal(
  signalA: Evidence['extractedSignals'][number],
  signalB: Evidence['extractedSignals'][number],
): boolean {
  if (signalA.targetField !== signalB.targetField) {
    return false;
  }

  return (
    (signalA.polarity === Polarity.POSITIVE && signalB.polarity === Polarity.NEGATIVE) ||
    (signalA.polarity === Polarity.NEGATIVE && signalB.polarity === Polarity.POSITIVE)
  );
}

const ENTITY_LINK_FIELDS: readonly (keyof EvidenceEntityLink)[] = [
  'organizationId',
  'productId',
  'competitorId',
  'marketId',
];

function sharesEntity(a: EvidenceEntityLink, b: EvidenceEntityLink): boolean {
  return ENTITY_LINK_FIELDS.some((field) => {
    const valueA = a[field];
    const valueB = b[field];
    return valueA !== undefined && valueB !== undefined && valueA === valueB;
  });
}
