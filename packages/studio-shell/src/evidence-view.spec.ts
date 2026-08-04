import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  buildProfileFromAnswers,
  produceScoredBifContext,
  type DiscoveryAnswer,
} from '@age/business-discovery-contracts';
import { describe, expect, it } from 'vitest';

import { evidenceNotAssessedFacets, presentEvidence } from './evidence-view';

/**
 * ⚠️ Driven through the REAL chain — the same reason as `bif-view.spec.ts`. A
 * hand-built profile could carry `fieldEvidence`, and the single most important
 * fact this screen reports is that `buildProfileFromAnswers` writes none.
 *
 * 🚫 Obviously fictional answers. Real client answers are never committed
 * (ADR-0053 D3).
 */
const ANSWERS: readonly DiscoveryAnswer[] = [
  { questionId: 'bi-name', value: 'Fictional Kite Repair' },
  { questionId: 'bi-industry', value: 'Entirely made-up kite maintenance' },
  { questionId: 'gc-goals', value: 'Repair more imaginary kites' },
  { questionId: 'ev-documents', value: ['An invented brand guide'] },
  { questionId: 'ev-urls', value: ['https://example.invalid/nothing-is-fetched'] },
  { questionId: 'ev-statements', value: ['The fictional owner said kites fly'] },
  { questionId: 'ev-assumptions', value: 'We assume imaginary kites keep breaking' },
];

function presented(answers: readonly DiscoveryAnswer[] = ANSWERS) {
  const profile = buildProfileFromAnswers(answers, DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE, {
    id: 'profile-fictional',
    capturedAt: '2026-01-01T00:00:00.000Z',
  });

  const { context, mappingMetadata } = produceScoredBifContext(profile, {
    organizationId: 'org-fictional',
    constructedAt: new Date('2026-01-01T00:00:00.000Z'),
    changedBy: 'operator:fictional',
    bifId: 'bif-fictional',
    questionnaire: DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  });

  return presentEvidence(
    profile,
    context,
    mappingMetadata,
    DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  );
}

describe('presentEvidence — named sources', () => {
  it('lists every source the operator named, with its kind', () => {
    const view = presented();
    expect(view.namedEvidence.map((source) => source.kind).sort()).toEqual([
      'client-statement',
      'document',
      'url',
    ]);
    expect(view.namedEvidence.map((source) => source.label)).toContain('An invented brand guide');
  });

  it('calls every named source unattributed, never known', () => {
    // 🚫 THE PROMOTION THIS SCREEN EXISTS TO REFUSE. Naming three sources does
    // not make anything verified: AGE has not opened one of them.
    const view = presented();
    expect(view.namedEvidence.every((source) => source.state === 'unattributed')).toBe(true);
  });

  it('carries a web reference as recorded text, never as something fetched', () => {
    const view = presented();
    const url = view.namedEvidence.find((source) => source.kind === 'url');
    expect(url?.label).toBe('https://example.invalid/nothing-is-fetched');
    expect(url?.state).toBe('unattributed');
  });

  it('lists nothing when the operator named nothing, and invents no source', () => {
    const view = presented([
      { questionId: 'bi-name', value: 'Fictional Kite Repair' },
      { questionId: 'gc-goals', value: 'Repair more imaginary kites' },
    ]);
    expect(view.namedEvidence).toEqual([]);
  });
});

describe('presentEvidence — beliefs', () => {
  it('reports every belief of a first discovery run as unsupported', () => {
    // ⚠️ The correct result, not a defect: nothing has been independently
    // verified, so the supported list is empty and the screen says why.
    const view = presented();
    expect(view.supportedBeliefs).toEqual([]);
    expect(view.unsupportedBeliefs.length).toBeGreaterThan(0);
    expect(view.unsupportedBeliefs.every((belief) => belief.state === 'unattributed')).toBe(true);
  });

  it('names the section and the field key of each unsupported belief', () => {
    const view = presented();
    const belief = view.unsupportedBeliefs[0];
    expect(belief?.sectionName.length).toBeGreaterThan(0);
    expect(belief?.fieldKey.length).toBeGreaterThan(0);
    expect(belief?.confidence.length).toBeGreaterThan(0);
  });

  it('reports no field as citing a source, because the capture never links them', () => {
    // ⚠️ THE POINT OF THE SCREEN. Three sources were named and no BIF field
    // cites any of them — `buildProfileFromAnswers` writes no `fieldEvidence`,
    // and 🚫 nothing here invents the link.
    const view = presented();
    expect(view.namedEvidence.length).toBe(3);
    expect(view.citedFieldPaths).toEqual([]);
  });
});

describe('presentEvidence — recorded answers', () => {
  it('keeps an answer no structured field carries, with its prompt', () => {
    const view = presented();
    const assumption = view.recordedAnswers.find((entry) => entry.questionId === 'ev-assumptions');
    expect(assumption?.value).toBe('We assume imaginary kites keep breaking');
    expect(assumption?.prompt).toBe('What key assumptions or unknowns remain?');
  });

  it('does not repeat an answer a profile signal already carried', () => {
    const view = presented();
    expect(view.recordedAnswers.map((entry) => entry.questionId)).not.toContain('ev-documents');
    expect(view.recordedAnswers.map((entry) => entry.questionId)).not.toContain('bi-name');
  });
});

describe('presentEvidence — what the mapper could not carry', () => {
  it('reports the mapper’s own unmapped fields, with reasons', () => {
    const view = presented();
    expect(view.unmappedFields.map((entry) => entry.field)).toContain('assumptions');
    expect(view.unmappedFields.every((entry) => entry.reason.length > 0)).toBe(true);
  });
});

describe('evidenceNotAssessedFacets', () => {
  it('reports what was never looked at as not-assessed, never as zero', () => {
    const facets = evidenceNotAssessedFacets();
    expect(facets.length).toBe(3);
    expect(facets.every((facet) => facet.state === 'not-assessed')).toBe(true);
  });

  it('says external references are refused, not pending', () => {
    const detail = evidenceNotAssessedFacets()[0]?.detail ?? '';
    expect(detail).toContain('refused');
    expect(detail).not.toContain('coming soon');
  });

  it('never says "no evidence" about the store it has not read', () => {
    const detail = evidenceNotAssessedFacets()[2]?.detail ?? '';
    expect(detail).toContain('nothing has looked');
  });
});

describe('evidence-view purity', () => {
  it('performs no retrieval and has no import path to persistence', () => {
    // ⚠️ Made to fail during development by adding a `fetch(` call to
    // `evidenceNotAssessedFacets`; the guard caught it, and it was removed.
    const source = readFileSync(
      fileURLToPath(new URL('./evidence-view.ts', import.meta.url)),
      'utf8',
    )
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    expect(source).toContain('import');
    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('node:fs');
    expect(source).not.toContain('new Date(');
    expect(source).not.toContain('@age/persistence');
    expect(source).not.toContain('business-discovery-capture');
    expect(source).not.toContain('produceAndCapture');
  });
});
