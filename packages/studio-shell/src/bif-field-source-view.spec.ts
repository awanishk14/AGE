import { SectionType } from '@age/bif';
import type { ProfileFieldProvenance } from '@age/business-discovery-contracts';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  PRODUCED_FROM_ANSWER_FILE,
  PROVENANCE_NEVER_CHANGES_A_SCORE,
  presentBifFieldSources,
} from './bif-field-source-view';
import type { BifSectionView } from './bif-view';
import { STORED_SNAPSHOT_PROVENANCE } from './stored-snapshot-view';

/** ⚠️ Obviously fictional throughout (ADR-0053 D3, ADR-0065 D1). */
const SECTIONS: readonly BifSectionView[] = [
  {
    id: 'sec-identity',
    name: 'Organization Identity',
    type: SectionType.OrganizationIdentity,
    confidenceScore: 0,
    completenessScore: 25,
    fields: [
      {
        key: 'legalName',
        type: 'text',
        value: 'Fictional Kite Repairs',
        state: 'unattributed',
        confidence: 'USER_CONFIRMED',
        source: 'USER',
        required: true,
      },
      {
        key: 'industry',
        type: 'text',
        value: 'Recreation',
        state: 'unattributed',
        confidence: 'USER_CONFIRMED',
        source: 'USER',
        required: false,
      },
    ],
  },
];

const CHANNEL: ProfileFieldProvenance = {
  profileId: 'fictional-discovery',
  entries: [{ fieldPath: 'businessName', questionId: 'bi-name', provenance: { kind: 'stated' } }],
};

describe('presentBifFieldSources', () => {
  it('shows the discovery field behind a BIF field, and how it was answered', () => {
    const [section] = presentBifFieldSources(SECTIONS, CHANNEL);

    expect(section?.fields[0]?.key).toBe('legalName');
    expect(section?.fields[0]?.fieldPath).toBe('businessName');
    expect(section?.fields[0]?.origins).toEqual([
      { kind: 'stated', questionId: 'bi-name', detail: 'Stated by a person in the intake.' },
    ]);
  });

  it('reports an unanswered field as not-recorded, and never as stated', () => {
    // 🚫 "A human typed this" is a claim. AGE has no basis for it here, so the
    // absent entry stays a third value (ADR-0066 §0.4c).
    const [section] = presentBifFieldSources(SECTIONS, CHANNEL);
    const industry = section?.fields[1];

    expect(industry?.origins[0]?.kind).toBe('not-recorded');
    expect(industry?.origins[0]?.detail).toContain('no record of how this field was answered');
    expect(industry?.origins[0]?.detail).toContain('not the same as it having been typed');
  });

  it('separates "discovery feeds no such field" from "nothing was recorded"', () => {
    const withUnfedField: readonly BifSectionView[] = [
      {
        ...SECTIONS[0]!,
        fields: [
          {
            key: 'foundingYear',
            type: 'text',
            value: '1998',
            state: 'unattributed',
            confidence: 'USER_CONFIRMED',
            source: 'USER',
            required: false,
          },
        ],
      },
    ];

    const [section] = presentBifFieldSources(withUnfedField, CHANNEL);
    expect(section?.fields[0]?.origins[0]?.kind).toBe('no-discovery-origin');
    expect(section?.fields[0]?.fieldPath).toBeUndefined();
  });

  /**
   * 🚫 THE RULE THIS SLICE IS MOST TEMPTED TO BREAK. Two origins for one field
   * are shown as two, each naming its own source — never one summarised label,
   * never a diff, never "mostly confirmed" (ADR-0066 D5).
   */
  it('🚫 keeps two origins for one field DISTINCT, and never merges them', () => {
    const twoOrigins: ProfileFieldProvenance = {
      profileId: 'fictional-discovery',
      entries: [
        { fieldPath: 'businessName', questionId: 'bi-name', provenance: { kind: 'stated' } },
        {
          fieldPath: 'businessName',
          questionId: 'bi-name-check',
          provenance: {
            kind: 'confirmed-from-source',
            sourceId: 'src-fictional-brief',
            locator: 'Fictional Kite Repairs brief (line 3)',
            confirmedBy: 'operator:fictional',
          },
        },
      ],
    };

    const [section] = presentBifFieldSources(SECTIONS, twoOrigins);
    const origins = section?.fields[0]?.origins ?? [];

    expect(origins).toHaveLength(2);
    expect(origins.map((origin) => origin.kind)).toEqual(['stated', 'confirmed-from-source']);
    expect(origins[1]).toMatchObject({
      sourceId: 'src-fictional-brief',
      locator: 'Fictional Kite Repairs brief (line 3)',
      confirmedBy: 'operator:fictional',
    });
  });

  /**
   * 🛑 AGE-INV-PROV-1. Identical facts with different provenance must produce
   * byte-identical scoring and BIF results. This view is the join point where a
   * number could start depending on an origin, so it is asserted HERE too: the
   * sections it was given come back untouched, and nothing it emits is a number.
   */
  it('🛑 carries no number, and changes nothing about the BIF it was shown', () => {
    const before = JSON.stringify(SECTIONS);
    const stated = presentBifFieldSources(SECTIONS, CHANNEL);
    const confirmed = presentBifFieldSources(SECTIONS, {
      profileId: 'fictional-discovery',
      entries: [
        {
          fieldPath: 'businessName',
          questionId: 'bi-name',
          provenance: {
            kind: 'confirmed-from-source',
            sourceId: 'src-fictional-brief',
            locator: 'line 3',
            confirmedBy: 'operator:fictional',
          },
        },
      ],
    });

    expect(JSON.stringify(SECTIONS)).toBe(before);
    expect(stated.length).toBe(confirmed.length);
    for (const view of [...stated, ...confirmed]) {
      for (const field of view.fields) {
        for (const origin of field.origins) {
          for (const value of Object.values(origin)) {
            expect(typeof value).not.toBe('number');
          }
        }
      }
    }
  });

  it('🚫 never carries the stored capture label, and says the one permitted sentence', () => {
    // 🚫 THE TWO ANSWERS ARE NEVER MERGED. This view describes the BIF produced
    // from the answer file; the stored capture is a different question.
    expect(PRODUCED_FROM_ANSWER_FILE).toContain('answer file');
    expect(PRODUCED_FROM_ANSWER_FILE).not.toBe(STORED_SNAPSHOT_PROVENANCE);
    expect(PROVENANCE_NEVER_CHANGES_A_SCORE).toContain('Provenance alone never changes a score.');
  });

  /**
   * 🚫 The two forbidden sentences are refused BY NAME (ADR-0066 §0.3). A guard
   * rather than a convention: each reads as reasonable, which is why each needs
   * to be impossible rather than discouraged.
   */
  it('🚫 says neither forbidden sentence anywhere in the module', () => {
    const source = readFileSync(new URL('./bif-field-source-view.ts', import.meta.url), 'utf8');
    const withoutComments = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    expect(withoutComments.length).toBeGreaterThan(0);
    expect(withoutComments).not.toMatch(/can never raise a score/i);
    expect(withoutComments).not.toMatch(/is not a source/i);
    expect(withoutComments).not.toMatch(/confidence/i);
  });
});
