import { describe, expect, it } from 'vitest';

import { DemoService } from '../application/demo.service';

/**
 * Guard: the public read-only demo endpoint publishes an EXACT, declared set of
 * item fields, and gains none silently.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS (ADR-0048 D5).
 *
 * `toBusinessDiscoverySummary` projects the intake block field-by-field, and
 * says why in its own docstring: the runtime summary is free to grow fields the
 * read-only endpoint has not decided to expose, and a spread would publish them
 * silently. Thirty lines below it, `toDemoReport` passes `acceptedItems`,
 * `rejectedReasons` and `duplicateReferences` through VERBATIM, typed
 * `readonly unknown[]` in the DTO. The discipline was real for one block and
 * absent for the other, and ADR-0047 D8 rested part of its reasoning on it.
 *
 * ⚠️ WHY THIS IS A PINNED KEY SET AND NOT A PROJECTION.
 *
 * The obvious-looking repair — project these arrays field-by-field like the
 * intake block — is wrong here, and was rejected deliberately. The six
 * capabilities emit SIX DIFFERENT decision-object shapes (7 to 17 keys), and
 * that content IS the demo: `apps/web` renders each item, and a projection down
 * to the three declared `CapabilityOutputItem` fields would publish
 * `id`/`capability`/`createdAt` and throw away every recommendation the demo
 * exists to show. Narrowing the payload would not make the endpoint honest; it
 * would make it empty.
 *
 * So the hole being closed is SILENCE, not breadth. A capability may publish a
 * rich object; it may not publish a NEW field without someone editing this file
 * and thereby deciding to. That is the same "pinned key set" pattern the
 * readiness specs use.
 *
 * ⚠️ If this test fails for a field you just added to a capability, add it here
 * deliberately — after checking it belongs in an UNAUTHENTICATED, PUBLIC
 * payload. Do not loosen the comparison to `toContain`, and do not delete the
 * capability's entry: an unpinned capability is exactly an unguarded one.
 */

/** The exact published key set, per capability, per array. */
const PUBLISHED_KEYS: Readonly<
  Record<
    string,
    { accepted: readonly string[]; rejected: readonly string[]; duplicate: readonly string[] }
  >
> = {
  Intelligence: {
    accepted: [
      'capability',
      'createdAt',
      'evidenceId',
      'freshnessDays',
      'id',
      'isContradiction',
      'qualityScore',
    ],
    rejected: ['detail', 'evidenceId', 'reasonCode'],
    duplicate: ['duplicateOfEvidenceId', 'evidenceId'],
  },
  'Market Discovery': {
    accepted: [
      'capability',
      'confidenceScore',
      'createdAt',
      'executionDomains',
      'id',
      'impactScore',
      'opportunityId',
      'opportunityType',
      'priority',
      'sourceRefs',
      'target',
    ],
    rejected: ['detail', 'opportunityId', 'reasonCode'],
    duplicate: ['duplicateOfOpportunityId', 'opportunityId'],
  },
  Growth: {
    accepted: [
      'capability',
      'confidenceScore',
      'createdAt',
      'effortBand',
      'effortScore',
      'executionDomains',
      'id',
      'impactScore',
      'planId',
      'planType',
      'priority',
      'sourceRefs',
      'target',
    ],
    rejected: ['detail', 'planId', 'reasonCode'],
    duplicate: ['duplicateOfPlanId', 'planId'],
  },
  Authority: {
    accepted: [
      'authorityPlanId',
      'capability',
      'confidenceScore',
      'createdAt',
      'effortBand',
      'effortScore',
      'executionDomains',
      'id',
      'impactScore',
      'planType',
      'priority',
      'sourceRefs',
      'target',
    ],
    rejected: ['authorityPlanId', 'detail', 'reasonCode'],
    duplicate: ['authorityPlanId', 'duplicateOfAuthorityPlanId'],
  },
  Operations: {
    accepted: [
      'capability',
      'confidenceScore',
      'createdAt',
      'effortBand',
      'effortScore',
      'executionDomains',
      'id',
      'operationalImpactScore',
      'operationsPlanId',
      'planType',
      'priority',
      'sourceRefs',
      'target',
    ],
    rejected: ['detail', 'operationsPlanId', 'reasonCode'],
    duplicate: ['duplicateOfOperationsPlanId', 'operationsPlanId'],
  },
  Revenue: {
    accepted: [
      'capability',
      'confidenceScore',
      'createdAt',
      'currency',
      'effortBand',
      'effortScore',
      'executionDomains',
      'id',
      'monetaryAmount',
      'planType',
      'priority',
      'recommendsProposalDraft',
      'revenueImpactScore',
      'revenuePlanId',
      'sourceRefs',
      'target',
      'valueBand',
    ],
    rejected: ['detail', 'reasonCode', 'revenuePlanId'],
    duplicate: ['duplicateOfRevenuePlanId', 'revenuePlanId'],
  },
};

/**
 * Scope identifiers must never reach this payload (ADR-0048 D2). Checked in
 * several spellings, because the rule is about the concept rather than about
 * one casing convention that happens to be current.
 */
const SCOPE_KEYS = ['clientId', 'organizationId', 'client_id', 'organization_id', 'tenantId'];

function keysOf(values: readonly unknown[]): string[] {
  const found = new Set<string>();
  for (const value of values) {
    if (value === null || typeof value !== 'object') continue;
    for (const key of Object.keys(value as Record<string, unknown>)) found.add(key);
  }
  return [...found].sort();
}

describe('the published demo item surface', () => {
  it('publishes exactly the pinned key set for every capability', async () => {
    const response = await new DemoService().getCapabilityDemo();

    // ⚠️ ASSERTED FIRST. A response with no reports would let every comparison
    // below pass vacuously and report a perfectly guarded endpoint.
    expect(response.reports).toHaveLength(6);

    let arraysInspected = 0;

    for (const report of response.reports) {
      const pinned = PUBLISHED_KEYS[report.capability];
      expect(pinned, `capability "${report.capability}" is not pinned in this file`).toBeDefined();
      if (!pinned) continue;

      expect(keysOf(report.acceptedItems), `${report.capability} acceptedItems`).toEqual([
        ...pinned.accepted,
      ]);
      expect(keysOf(report.rejectedReasons), `${report.capability} rejectedReasons`).toEqual([
        ...pinned.rejected,
      ]);
      expect(
        keysOf(report.duplicateReferences),
        `${report.capability} duplicateReferences`,
      ).toEqual([...pinned.duplicate]);

      arraysInspected += 3;
    }

    // ⚠️ Counted and asserted AFTER the loop: the per-capability arrays are not
    // uniform, and a loop that examined nothing must not read as compliance.
    expect(arraysInspected).toBe(18);
  });

  it('carries no scope identifier anywhere in the published payload', async () => {
    // ADR-0048 D2 — permanent, not deferred. The demo scope values are static
    // synthetic fixtures today, which is exactly why the rule is enforced now:
    // this DTO shape is the template a real, authenticated deployment would
    // inherit, and the route has no auth to contain the blast radius.
    const response = await new DemoService().getCapabilityDemo();
    const serialized = JSON.stringify(response);

    expect(serialized.length).toBeGreaterThan(0);
    for (const key of SCOPE_KEYS) {
      expect(serialized, `"${key}" must never reach the public read-only payload`).not.toContain(
        `"${key}"`,
      );
    }
  });
});
