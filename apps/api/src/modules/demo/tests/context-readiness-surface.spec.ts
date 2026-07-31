import { describe, expect, it } from 'vitest';

import { DemoService } from '../application/demo.service';

/**
 * Guard: the context-readiness block on `GET /demo/capabilities`
 * (ADR-0048 D3 step 4).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS BLOCK IS
 *
 * Stage two of the demo pipeline — intake → context readiness → capability
 * runs. The CLI has printed it since ADR-0047 slice 3; this publishes the same
 * stage over the wire, unchanged in shape and unchanged in what it refuses to
 * say.
 *
 * ⚠️ WHAT IT MUST NEVER GROW (ADR-0047 D4 / ADR-0048 D7)
 *
 * No aggregate of any kind. No "overall readiness", no count of how many
 * capabilities are ready, no ordering by state, no colour scale. The three
 * published states are incommensurable in DENOMINATOR, not merely in where a
 * line was drawn: each capability judges a different set of BIF sections
 * against its own published thresholds. Any value computed across them would
 * invent a scale that does not exist, and the invented scale is what a reader
 * would then act on.
 *
 * ⚠️ A non-adopter's row carries NO state (ADR-0047 D5) — not `null`, not `0`,
 * not `"N/A"`, not a defaulted `sufficiency`. Non-adoption is a declared
 * property of the capability. A filled-in value publishes it as a deficiency.
 *
 * ⚠️ No scope identifier may appear (ADR-0048 D2, permanent). This endpoint is
 * unauthenticated; the demo's scope values are synthetic, which is exactly why
 * the rule is enforced now — this DTO is the template a real deployment
 * inherits.
 */

/** Fixed registry order, and the same six names the run reports use. */
const REGISTRY_ORDER = [
  'Intelligence',
  'Market Discovery',
  'Growth',
  'Authority',
  'Operations',
  'Revenue',
];

/** The three ADR-0027 adopters. The other three declare no assessment. */
const ADOPTERS = ['Intelligence', 'Market Discovery', 'Revenue'];

/** The exact published key set for a readiness row. */
const PUBLISHED_ENTRY_KEYS = [
  'assessesContext',
  'capabilityName',
  'declaration',
  'denominator',
  'improvementHints',
  'limitations',
  'reasons',
  'requiredSectionTypes',
  'state',
  'thresholds',
];

const SCOPE_KEYS = ['clientId', 'organizationId', 'client_id', 'organization_id', 'tenantId'];

/**
 * Names that would express an aggregate. ⚠️ Matched against the block's own
 * KEYS only — never against prose, since the incommensurability notice
 * legitimately contains the word "summarising" while saying there is no summary.
 */
const AGGREGATE_KEY = /(overall|aggregate|average|combined|total|rank|score|index|grade|tier)/i;

describe('the published context-readiness surface', () => {
  it('publishes the readiness stage beside the runs, in fixed registry order', async () => {
    const response = await new DemoService().getCapabilityDemo();
    const readiness = response.contextReadiness;

    expect(readiness, 'the response carries no contextReadiness block').toBeDefined();
    expect(readiness.entries).toHaveLength(6);
    expect(readiness.entries.map((entry) => entry.capabilityName)).toEqual(REGISTRY_ORDER);
    // The same six names, in the same order, as the run reports — one set of
    // names across both stages, so a reader is never asked to align two lists.
    expect(readiness.entries.map((entry) => entry.capabilityName)).toEqual(
      response.reports.map((report) => report.capability),
    );
  });

  it('carries the incommensurability notice ON the payload, not as documentation', async () => {
    const response = await new DemoService().getCapabilityDemo();
    const notice = response.contextReadiness.incommensurabilityNotice;

    // Asserted first: an empty notice would make every assertion below vacuous.
    expect(notice.length, 'the notice is empty — the states read as a scale').toBeGreaterThan(0);
    const joined = notice.join(' ');
    expect(joined).toContain('NOT comparable');
    expect(joined).toContain('own published thresholds');
    // It must also say that the runs are not derived from the states.
    expect(joined).toContain('no work is derived from any state below');
  });

  it('publishes exactly the pinned key set, and no aggregate anywhere', async () => {
    const response = await new DemoService().getCapabilityDemo();
    const readiness = response.contextReadiness;

    expect(Object.keys(readiness).sort()).toEqual(['entries', 'incommensurabilityNotice']);

    let rowsChecked = 0;
    for (const entry of readiness.entries) {
      const keys = Object.keys(entry).sort();
      // ⚠️ A superset is the failure this pins: a field added upstream must be
      // published by someone editing this list, never silently.
      expect(keys, `${entry.capabilityName} publishes an unpinned key set`).toEqual(
        PUBLISHED_ENTRY_KEYS,
      );
      for (const key of keys) {
        expect(key, `${entry.capabilityName}.${key} names an aggregate`).not.toMatch(AGGREGATE_KEY);
      }
      // Thresholds are the one place numbers legitimately live. They are this
      // capability's OWN, so their keys are checked for an aggregate too.
      for (const key of Object.keys(entry.thresholds ?? {})) {
        expect(key, `${entry.capabilityName}.thresholds.${key}`).not.toMatch(/overall|combined/i);
      }
      rowsChecked += 1;
    }
    // Counted and asserted AFTER the loop: a zero-row block would otherwise
    // report compliance.
    expect(rowsChecked).toBe(6);
  });

  it('gives every adopter a state adjacent to its OWN denominator', async () => {
    const response = await new DemoService().getCapabilityDemo();

    let adoptersChecked = 0;
    for (const entry of response.contextReadiness.entries) {
      if (!ADOPTERS.includes(entry.capabilityName)) continue;
      expect(typeof entry.state, `${entry.capabilityName} has no state`).toBe('string');
      expect(entry.state, `${entry.capabilityName} state is empty`).not.toBe('');
      // ⚠️ A state without its denominator invites exactly the cross-capability
      // comparison the notice denies.
      expect(entry.denominator, `${entry.capabilityName} states no denominator`).toBeTruthy();
      expect(entry.thresholds, `${entry.capabilityName} publishes no thresholds`).toBeDefined();
      expect(
        (entry.reasons ?? []).length,
        `${entry.capabilityName} gives no reasons`,
      ).toBeGreaterThan(0);
      adoptersChecked += 1;
    }
    expect(adoptersChecked).toBe(3);
  });

  it('leaves a non-adopter row genuinely absent, never null, 0 or "N/A"', async () => {
    const response = await new DemoService().getCapabilityDemo();

    let nonAdoptersChecked = 0;
    for (const entry of response.contextReadiness.entries) {
      if (ADOPTERS.includes(entry.capabilityName)) continue;
      for (const field of ['state', 'reasons', 'thresholds', 'requiredSectionTypes'] as const) {
        const value = entry[field];
        expect(value, `${entry.capabilityName}.${field} was filled in`).toBeUndefined();
      }
      // The row still says what it is — silence about the capability would be
      // its own misreading.
      expect(entry.declaration, `${entry.capabilityName} declares nothing`).toBeTruthy();
      nonAdoptersChecked += 1;
    }
    expect(nonAdoptersChecked).toBe(3);
  });

  it('never orders the rows by state, and carries no scope identifier', async () => {
    const response = await new DemoService().getCapabilityDemo();
    const entries = response.contextReadiness.entries;

    // Registry order interleaves adopters and non-adopters. If the rows were
    // ever grouped or sorted by state, the adopters would become contiguous.
    const adopterPositions = entries
      .map((entry, index) => (entry.state === undefined ? -1 : index))
      .filter((index) => index >= 0);
    expect(adopterPositions.length).toBe(3);
    const contiguous = adopterPositions.every(
      (index, i) => i === 0 || index === (adopterPositions[i - 1] ?? -1) + 1,
    );
    expect(contiguous, 'the adopter rows are contiguous — the block looks sorted by state').toBe(
      false,
    );

    const serialized = JSON.stringify(response.contextReadiness);
    for (const key of SCOPE_KEYS) {
      expect(serialized, `"${key}" must never reach the public read-only payload`).not.toContain(
        `"${key}"`,
      );
    }
  });

  it('is deterministic — the stage reads no wall clock', async () => {
    // ⚠️ `producedAt` is supplied from the frozen scenario time. A `new Date()`
    // anywhere on this path would make two identical requests differ.
    const first = await new DemoService().getCapabilityDemo();
    const second = await new DemoService().getCapabilityDemo();
    expect(JSON.stringify(first.contextReadiness)).toBe(JSON.stringify(second.contextReadiness));
  });
});
