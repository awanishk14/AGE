import {
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  buildProfileFromAnswers,
  normalizeScoredBifSnapshotRecord,
  produceScoredBifContext,
  toScoredBifSnapshot,
  type DiscoveryAnswer,
  type ScoredBifSnapshotRecord,
} from '@age/business-discovery-contracts';
import { describe, expect, it } from 'vitest';

import {
  ANSWER_FILE_PROVENANCE,
  STORED_SNAPSHOT_PROVENANCE,
  TWO_ANSWERS_NOTICE,
  buildStoredSnapshotView,
} from './stored-snapshot-view';

/**
 * ⚠️ Driven through the REAL produce chain and the REAL record normalizer, not a
 * hand-built record. A fixture record would let this view agree with a shape the
 * store no longer holds — and stored rows are untrusted input precisely because
 * nothing guarantees the two stay in step by convention.
 *
 * 🚫 The answers are obviously fictional. Real client records are never
 * committed (ADR-0053 D3, ADR-0065 D1).
 */
function storedFixture(): ScoredBifSnapshotRecord {
  const answers: readonly DiscoveryAnswer[] = [
    { questionId: 'bi-name', value: 'Fictional Kite Repair' },
    { questionId: 'bi-industry', value: 'Entirely made-up kite maintenance' },
  ];

  const profile = buildProfileFromAnswers(answers, DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE, {
    id: 'profile-fictional',
    capturedAt: '2026-01-01T00:00:00.000Z',
  });

  const { context } = produceScoredBifContext(profile, {
    organizationId: 'org-fictional',
    constructedAt: new Date('2026-01-01T00:00:00.000Z'),
    changedBy: 'operator:fictional',
    bifId: 'bif-fictional',
    questionnaire: DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  });

  return normalizeScoredBifSnapshotRecord({
    clientId: 'client-fictional',
    organizationId: 'org-fictional',
    bifId: 'bif-fictional',
    snapshotId: 'snapshot-fictional',
    capturedAt: '2026-01-02T00:00:00.000Z',
    snapshot: toScoredBifSnapshot(context),
  });
}

describe('buildStoredSnapshotView', () => {
  const record = storedFixture();
  const view = buildStoredSnapshotView(record);

  it('carries the row’s own identity, not the screen’s assumption of it', () => {
    expect(view.snapshotId).toBe('snapshot-fictional');
    expect(view.bifId).toBe('bif-fictional');
  });

  it('shows the captured instant verbatim', () => {
    // 🚫 Never reformatted into "2 days ago". A relative time is a computed
    // claim about now, and the row is a claim about then.
    expect(view.capturedAt).toBe('2026-01-02T00:00:00.000Z');
  });

  it('names its own provenance on the view', () => {
    expect(view.provenance).toBe(STORED_SNAPSHOT_PROVENANCE);
  });

  it('reports the two BIF scores exactly as stored', () => {
    expect(view.bifConfidenceScore).toBe(record.snapshot.context.bifConfidenceScore);
    expect(view.bifCompletenessScore).toBe(record.snapshot.context.bifCompletenessScore);
  });

  it('reports the two discovery scores as NOT STORED, never as zero', () => {
    // 🚫 The failure this prevents: a `0` that turns "AGE never kept this" into
    // "AGE kept this and it was empty".
    expect(view.notStored.map((entry) => entry.label)).toEqual([
      'discoveryConfidenceScore',
      'discoveryCompletenessScore',
    ]);

    for (const entry of view.notStored) {
      expect(entry.state).toBe('not-stored');
      expect(entry.detail).toContain('absent, not zero');
    }

    // The view offers no numeric field for either. A caller cannot render one
    // even by mistake.
    expect(Object.keys(view)).not.toContain('discoveryConfidenceScore');
    expect(Object.keys(view)).not.toContain('discoveryCompletenessScore');
  });

  it('names omitted sections rather than counting them', () => {
    expect(view.omittedSections.length).toBe(view.omittedSectionCount);
    expect(view.omittedSections.length).toBeGreaterThan(0);

    for (const omitted of view.omittedSections) {
      expect(omitted.name.length).toBeGreaterThan(0);
      expect(omitted.type.length).toBeGreaterThan(0);
    }
  });

  it('names present sections and agrees with the stored count', () => {
    expect(view.sections.length).toBe(view.presentSectionCount);
    expect(view.canonicalSectionCount).toBeGreaterThan(view.presentSectionCount);
  });

  it('states its own singularity rather than implying a history', () => {
    // ⚠️ ADR-0064 D4. The screen shows one row because one row is all it may
    // read — and it says so, instead of leaving an empty list to read as
    // "nothing else happened".
    expect(view.singularity).toContain('not authorized');
    expect(view.singularity).toContain('no history');
  });

  it('publishes no aggregate, band, verdict or rank', () => {
    // 🚫 ADR-0064 D6. Asserted structurally so a later "small addition" fails
    // here rather than shipping.
    const keys = Object.keys(view);
    for (const forbidden of ['band', 'overall', 'rank', 'verdict', 'readiness', 'total', 'average'])
      expect(keys.some((key) => key.toLowerCase().includes(forbidden))).toBe(false);

    // ⚠️ And exactly two score fields, each named for the thing it measures.
    // A third would be a combination of the first two, which is the number
    // ADR-0047 D4 declined to create a scale for.
    expect(keys.filter((key) => key.toLowerCase().includes('score'))).toEqual([
      'bifConfidenceScore',
      'bifCompletenessScore',
    ]);
  });
});

describe('the two provenances', () => {
  it('are distinct labels, and neither is just “readiness”', () => {
    expect(STORED_SNAPSHOT_PROVENANCE).not.toBe(ANSWER_FILE_PROVENANCE);
    expect(STORED_SNAPSHOT_PROVENANCE).toContain('immutable');
    expect(ANSWER_FILE_PROVENANCE).toContain('editable');
  });

  it('carry the notice that they are different questions, never one', () => {
    // 🛑 ADR-0064 D3 is this sentence. If it is ever softened, this fails.
    const notice = TWO_ANSWERS_NOTICE.join(' ');

    expect(notice).toContain('two different questions');
    expect(notice).toContain('does not decide');
    expect(notice).toContain('left standing');
  });

  it('never describes either answer as out of date, drifted or preferred', () => {
    const notice = TWO_ANSWERS_NOTICE.join(' ').toLowerCase();

    for (const forbidden of ['out of date', 'drift', 'stale', 'correct one', 'more accurate']) {
      expect(notice.includes(forbidden)).toBe(false);
    }
  });
});
