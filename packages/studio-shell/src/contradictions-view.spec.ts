import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  buildProfileFromAnswers,
  produceScoredBifContext,
  type DiscoveryAnswer,
} from '@age/business-discovery-contracts';
import { describe, expect, it } from 'vitest';

import { presentContradictions } from './contradictions-view';
import { presentEvidence, type EvidenceView, type NamedEvidenceView } from './evidence-view';

/**
 * ⚠️ Driven through the REAL chain — answers → profile → scored context → the
 * real evidence account — for the same reason as `evidence-view.spec.ts`. The
 * fact this screen must get right (that a recorded source carries no signal and
 * no entity link) is a property of the real mapper, not of a fixture.
 *
 * 🚫 Obviously fictional answers. Real client answers are never committed
 * (ADR-0053 D3).
 */
const ANSWERS: readonly DiscoveryAnswer[] = [
  { questionId: 'bi-name', value: 'Fictional Kite Repair' },
  { questionId: 'bi-industry', value: 'Entirely made-up kite maintenance' },
  { questionId: 'gc-goals', value: 'Repair more imaginary kites' },
];

function realEvidence(): EvidenceView {
  const profile = buildProfileFromAnswers(ANSWERS, DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE, {
    id: 'profile-fictional',
    capturedAt: '2026-01-01T00:00:00.000Z',
  });

  const { context, mappingMetadata } = produceScoredBifContext(profile, {
    organizationId: 'org-fictional',
    constructedAt: new Date('2026-01-01T00:00:00.000Z'),
    changedBy: 'operator@example.invalid',
    questionnaire: DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  });

  return presentEvidence(
    profile,
    context,
    mappingMetadata,
    DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  );
}

describe('presentContradictions', () => {
  /**
   * 🛑 THE POINT OF THE ENTIRE SCREEN. `detectContradictions` would run and
   * return an empty set. Printing that as "no contradictions" would state that
   * AGE checked a real business and found it consistent. Nothing checked it.
   */
  it('never reports an outcome other than not-run', () => {
    const view = presentContradictions(realEvidence());

    expect(view.outcome).toBe('not-run');
    expect(view.outcomeBecause.length).toBeGreaterThan(40);
  });

  it('reports every precondition of the real detector, none of them met', () => {
    const view = presentContradictions(realEvidence());

    expect(view.preconditions.length).toBe(4);
    expect(view.preconditions.map((p) => p.status)).toEqual([
      'unmet',
      'unmet',
      'unevaluable',
      'unevaluable',
    ]);
    for (const precondition of view.preconditions) {
      expect(precondition.requirement.length).toBeGreaterThan(20);
      expect(precondition.observed.length).toBeGreaterThan(20);
    }
  });

  /**
   * ⚠️ `unmet` and `unevaluable` must stay distinct. `unmet` is a shortfall AGE
   * measured; `unevaluable` is a precondition it could not even check because an
   * earlier one failed. Collapsing them presents "we could not look" as "we
   * looked and it was short".
   */
  it('distinguishes a measured shortfall from one it could not check', () => {
    const view = presentContradictions(realEvidence());
    const statuses = new Set(view.preconditions.map((p) => p.status));

    expect(statuses.has('unmet')).toBe(true);
    expect(statuses.has('unevaluable')).toBe(true);
  });

  /**
   * ⚠️ The count that explains the whole screen: the capture DOES record
   * sources, and NONE of them carries what the detector reads. 🚫 Reporting
   * "0 sources" would be a different and false statement — it would say the
   * operator recorded nothing.
   */
  it('separates sources recorded from sources the detector could read', () => {
    const view = presentContradictions(realEvidence());

    expect(view.namedSourceCount).toBe(realEvidence().namedEvidence.length);
    expect(view.signalCarryingSourceCount).toBe(0);
  });

  /**
   * ⚠️ Derived, not hard-coded to zero. If evidence ever carries an extracted
   * signal and an entity link, the count moves — and this screen must then be
   * rewritten rather than continuing to report "cannot run". Made to fail by
   * returning a constant `false` from `carriesDetectableSignal`.
   */
  it('counts signal-carrying sources rather than asserting there are none', () => {
    const evidence = realEvidence();
    const carrier = {
      id: 'src-hypothetical',
      label: 'A hypothetical source that carries a signal',
      kind: 'document',
      state: 'unattributed',
      extractedSignals: [{ targetField: 'demand', polarity: 'POSITIVE' }],
      entityLinked: { organizationId: 'org-fictional' },
    } as unknown as NamedEvidenceView;

    const view = presentContradictions({
      ...evidence,
      namedEvidence: [...evidence.namedEvidence, carrier, carrier],
    });

    expect(view.signalCarryingSourceCount).toBe(2);
    // 🚫 Even with detectable input the view does not claim a result — the
    // detector is still not run here, and the screen still says so.
    expect(view.outcome).toBe('not-run');
    expect(view.preconditions[0]?.status).toBe('met');
  });

  it('states three things it has not looked at, each with a reason', () => {
    const view = presentContradictions(realEvidence());

    expect(view.notAssessed.length).toBe(3);
    for (const facet of view.notAssessed) {
      expect(facet.state).toBe('not-assessed');
      expect(facet.because.length).toBeGreaterThan(30);
    }
  });

  /**
   * 🚫 No sentence anywhere in the view may read as a clean bill of health.
   */
  it('prints no phrase that reads as a checked-and-consistent result', () => {
    const view = presentContradictions(realEvidence());
    const text = JSON.stringify(view).toLowerCase();
    let checked = 0;

    for (const phrase of [
      'no contradictions found',
      'no contradictions detected',
      'no conflicts',
      'consistent',
      'all clear',
      'up to date',
      'no issues',
    ]) {
      checked += 1;
      expect(text, `the view must not say "${phrase}"`).not.toContain(phrase);
    }

    expect(checked).toBe(7);
  });
});

describe('contradictions-view purity', () => {
  /**
   * 🛑 THE LOAD-BEARING GUARD. The detector is not merely unused here — there is
   * no import path to it, so no edit can call it without deleting this test.
   *
   * ⚠️ Made to fail during development by adding
   * `import { detectContradictions } from '@age/intelligence'`; the guard named
   * it, and it was removed.
   */
  it('has no import path to the contradiction detector', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./contradictions-view.ts', import.meta.url)),
      'utf8',
    )
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    expect(source).toContain('import');
    expect(source).not.toContain('detectContradictions');
    expect(source).not.toContain('@age/intelligence');
    expect(source).not.toContain('@age/evidence-contracts');
    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('node:fs');
    expect(source).not.toContain('new Date(');
    expect(source).not.toContain('Date.now(');
    expect(source).not.toContain('Math.random(');
    expect(source).not.toContain('process.env');
    expect(source).not.toContain('@age/persistence');
    expect(source).not.toContain('business-discovery-capture');
  });
});
