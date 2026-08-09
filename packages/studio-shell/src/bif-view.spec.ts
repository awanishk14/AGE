import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  buildProfileFromAnswers,
  produceScoredBifContext,
  type DiscoveryAnswer,
} from '@age/business-discovery-contracts';
import { describe, expect, it } from 'vitest';

import {
  fieldStateOf,
  presentGeneratedBif,
  renderFieldValue,
  storedHistoryFacets,
} from './bif-view';
import { STATED_ANSWER_PROVENANCE } from '@age/business-discovery-contracts';

/**
 * ⚠️ Driven through the REAL produce chain, not a hand-built context. A fixture
 * context would let the view agree with a shape the pipeline no longer emits,
 * which is the failure the chain function itself was written to stop.
 *
 * 🚫 The answers below are obviously fictional. Real client answers are never
 * committed (ADR-0053 D3).
 */
function producedFixture() {
  const answers: readonly DiscoveryAnswer[] = [
    { questionId: 'bi-name', value: 'Fictional Kite Repair', provenance: STATED_ANSWER_PROVENANCE },
    {
      questionId: 'bi-industry',
      value: 'Entirely made-up kite maintenance',
      provenance: STATED_ANSWER_PROVENANCE,
    },
    {
      questionId: 'gc-goals',
      value: 'Repair more imaginary kites',
      provenance: STATED_ANSWER_PROVENANCE,
    },
  ];

  const profile = buildProfileFromAnswers(answers, DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE, {
    id: 'profile-fictional',
    capturedAt: '2026-01-01T00:00:00.000Z',
  });

  return produceScoredBifContext(profile, {
    organizationId: 'org-fictional',
    constructedAt: new Date('2026-01-01T00:00:00.000Z'),
    changedBy: 'operator:fictional',
    bifId: 'bif-fictional',
    questionnaire: DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  });
}

const present = () => {
  const { context, mappingMetadata, scoringMetadata } = producedFixture();
  return presentGeneratedBif(context, mappingMetadata, scoringMetadata);
};

describe('fieldStateOf', () => {
  it('calls only evidence-verified values known', () => {
    expect(fieldStateOf('EVIDENCE_VERIFIED')).toBe('known');
  });

  it('calls a business’s own answer unattributed, never known', () => {
    // 🚫 The promotion that would make the screen look fuller and be wrong: a
    // claim AGE recorded is not a fact AGE checked.
    expect(fieldStateOf('USER_CONFIRMED')).toBe('unattributed');
  });

  it('calls an inferred value unattributed too', () => {
    expect(fieldStateOf('AI_INFERRED')).toBe('unattributed');
  });
});

describe('renderFieldValue', () => {
  it('renders strings, numbers and booleans as themselves', () => {
    expect(renderFieldValue('kite')).toBe('kite');
    expect(renderFieldValue(12)).toBe('12');
    expect(renderFieldValue(false)).toBe('false');
  });

  it('joins a list rather than showing one entry', () => {
    expect(renderFieldValue(['a', 'b'])).toBe('a, b');
  });

  it('never renders a value as a placeholder', () => {
    // 🚫 A field that reached the BIF has a value. A dash would be
    // indistinguishable from a field that never arrived.
    expect(renderFieldValue('')).toBe('');
    expect(renderFieldValue(0)).toBe('0');
    expect(renderFieldValue(0)).not.toBe('—');
  });
});

describe('presentGeneratedBif', () => {
  it('carries the BIF identity and status through unchanged', () => {
    const view = present();
    expect(view.bifId).toBe('bif-fictional');
    expect(view.bifStatus).toBe('Draft');
  });

  it('keeps the four scores apart and invents no fifth', () => {
    // ⚠️ Intake completeness and BIF completeness measure different things.
    // 🚫 No combined or headline score exists on this view.
    const { context, mappingMetadata, scoringMetadata } = producedFixture();
    const view = presentGeneratedBif(context, mappingMetadata, scoringMetadata);

    expect(view.scores.discoveryCompletenessScore).toBe(mappingMetadata.discoveryCompletenessScore);
    expect(view.scores.discoveryConfidenceScore).toBe(mappingMetadata.discoveryConfidenceScore);
    expect(view.scores.bifCompletenessScore).toBe(context.bifCompletenessScore);
    expect(view.scores.bifConfidenceScore).toBe(context.bifConfidenceScore);
    expect(Object.keys(view.scores)).toHaveLength(4);
    expect(Object.keys(view)).not.toContain('overallScore');
  });

  it('recomputes no score of its own', () => {
    const { context, mappingMetadata, scoringMetadata } = producedFixture();
    const view = presentGeneratedBif(context, mappingMetadata, scoringMetadata);

    for (const [index, section] of view.sections.entries()) {
      expect(section.confidenceScore).toBe(context.sections[index]?.confidenceScore);
      expect(section.completenessScore).toBe(context.sections[index]?.completenessScore);
    }
  });

  it('reports omitted sections as unknown, never as not-assessed', () => {
    // ⚠️ The answers WERE read and said nothing about these sections. That is a
    // result. 🚫 "not-assessed" would claim nothing had looked.
    const view = present();

    expect(view.omittedSections.length).toBeGreaterThan(0);
    for (const section of view.omittedSections) {
      expect(section.state).toBe('unknown');
    }
  });

  it('never placeholder-fills an omitted section into the section list', () => {
    // 🚫 Partial Draft BIFs OMIT sections; they are never filled with empty
    // shells so the page can show a full grid.
    const view = present();
    const omitted = new Set(view.omittedSections.map((section) => section.type));

    for (const section of view.sections) {
      expect(omitted.has(section.type)).toBe(false);
      expect(section.fields.length).toBeGreaterThan(0);
    }
  });

  it('counts present and omitted sections from what it was given', () => {
    const { context, mappingMetadata, scoringMetadata } = producedFixture();
    const view = presentGeneratedBif(context, mappingMetadata, scoringMetadata);

    expect(view.presentSectionCount).toBe(context.sections.length);
    expect(view.omittedSectionCount).toBe(context.omittedSections.length);
  });

  it('surfaces every field as a claim of the business, not a verified fact', () => {
    // ⚠️ A first discovery run has no independent evidence, so nothing is
    // `known`. A screen that showed otherwise would be inventing verification.
    const view = present();
    const states = view.sections.flatMap((section) => section.fields.map((field) => field.state));

    expect(states.length).toBeGreaterThan(0);
    expect(states.every((state) => state === 'unattributed')).toBe(true);
  });

  it('carries the confidence and source enums verbatim, so a state is auditable', () => {
    const view = present();
    const field = view.sections.flatMap((section) => section.fields)[0];

    expect(field?.confidence).toBe('USER_CONFIRMED');
    expect(typeof field?.source).toBe('string');
  });

  it('reports the mapper’s unmapped fields rather than re-deriving them', () => {
    const { context, mappingMetadata, scoringMetadata } = producedFixture();
    const view = presentGeneratedBif(context, mappingMetadata, scoringMetadata);

    expect(view.unmappedFields).toHaveLength(mappingMetadata.unmappedDiscoveryFields.length);
  });

  it('reports the scorer’s own version rather than a number of its own', () => {
    const { context, mappingMetadata, scoringMetadata } = producedFixture();
    const view = presentGeneratedBif(context, mappingMetadata, scoringMetadata);

    expect(view.scoringVersion).toBe(scoringMetadata.scoringVersion);
  });
});

describe('storedHistoryFacets', () => {
  it('reports every stored fact as not-assessed', () => {
    // 🛑 ADR-0055 D7 is undischarged: nothing in the console has read the
    // capture store. 🚫 No row is seeded to make this render.
    const facets = storedHistoryFacets();

    expect(facets.length).toBeGreaterThan(0);
    for (const facet of facets) {
      expect(facet.state).toBe('not-assessed');
    }
  });

  it('never renders the absence as a zero or a "never"', () => {
    // ⚠️ The same error class as defaulting `sufficiency` to `ready`: an
    // unlooked-at absence rendered as a measured value.
    const text = storedHistoryFacets()
      .map((facet) => `${facet.label} ${facet.detail}`)
      .join(' ');

    expect(text).not.toMatch(/\b0 snapshots\b/);
    expect(text).not.toMatch(/:\s*never\b/i);
    expect(text).toMatch(/nothing has looked/);
  });
});

describe('the module itself', () => {
  it('has no import path to persistence or capture', () => {
    // 🚫 `produceAndCapture` is not merely unused here, it is unreachable.
    // ADR-0054 D6's five conditions are untouched and ADR-0046 D7 stands.
    const source = readFileSync(fileURLToPath(new URL('./bif-view.ts', import.meta.url)), 'utf8')
      // ⚠️ Comments stripped first: this file's own explanation of the rule
      // names the very tokens the scan bans.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    expect(source).toContain('import');
    expect(source).not.toContain('@age/persistence');
    expect(source).not.toContain('business-discovery-capture');
    expect(source).not.toContain('produceAndCapture');
    expect(source).not.toContain('@prisma/client');
  });
});
