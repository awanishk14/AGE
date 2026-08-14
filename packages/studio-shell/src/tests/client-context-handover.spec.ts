import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildClientContextHandover } from '../client-context-handover';
import {
  HOW_THIS_REACHES_A_PEER_NOTICE,
  presentClientContextProjection,
  type ClientContextProjectionView,
} from '../client-context-projection-view';
import type { ClientContextProjection } from '@age/client-context-projection';

/**
 * ⚠️ A fixture whose values are OBVIOUSLY FICTIONAL (ADR-0053 D3) — a realistic
 * one would make the guards read as a client record.
 */
function projectionFixture(): ClientContextProjection {
  return {
    bifId: 'bif-fixture-0001',
    asOf: '2026-01-01T00:00:00.000Z',
    subjectKinds: [
      {
        subjectKind: 'service',
        state: 'modelled',
        labels: ['Fictional Offering One', 'Fictional Offering Two'],
        unreadableEntryCount: 1,
        because: 'The business named these during discovery.',
      },
      {
        subjectKind: 'geography',
        state: 'never-captured',
        labels: [],
        unreadableEntryCount: 0,
        because: 'AGE was never told about this.',
      },
      {
        subjectKind: 'audience',
        state: 'captured-nothing-recorded',
        labels: [],
        unreadableEntryCount: 0,
        because: 'The question was asked and nothing was recorded.',
      },
    ],
    notCaptured: ['Fictional Section A'],
    notices: ['A notice the consumer cannot drop.'],
  };
}

function viewFixture(): ClientContextProjectionView {
  return presentClientContextProjection(projectionFixture());
}

describe('buildClientContextHandover — what the operator carries (ADR-0071 D1)', () => {
  it('🛑 carries the projection UNCHANGED — every value survives the round trip', () => {
    const view = viewFixture();
    const parsed = JSON.parse(buildClientContextHandover(view).document) as Record<string, unknown>;

    expect(parsed.bifId).toBe(view.bifId);
    expect(parsed.asOf).toBe(view.asOf);
    expect(parsed.notCaptured).toEqual([...view.notCaptured]);
    expect(parsed.notices).toEqual([...view.notices]);
    expect(parsed.subjectKinds).toEqual(
      view.subjectKinds.map((kind) => ({
        subjectKind: kind.subjectKind,
        state: kind.state,
        labels: [...kind.labels],
        unreadableEntryCount: kind.unreadableEntryCount,
        because: kind.because,
      })),
    );
  });

  it('🛑 THE KEY SET IS PINNED, 🚫 NOT SEARCHED — 🚫 no field the projection lacks', () => {
    const parsed = JSON.parse(buildClientContextHandover(viewFixture()).document) as Record<
      string,
      unknown
    >;

    expect(Object.keys(parsed).sort()).toEqual([
      'asOf',
      'bifId',
      'notCaptured',
      'notices',
      'subjectKinds',
    ]);
  });

  it("🚫 THE CONSOLE'S OWN SENTENCE NEVER TRAVELS to a peer", () => {
    const document = buildClientContextHandover(viewFixture()).document;

    // 🛑 The notice is a claim about AGE's SURFACE, authored for an operator.
    // A peer receiving it would receive a claim AGE never made about the
    // business — and would read a console's limitation as a business fact.
    expect(document).not.toContain(HOW_THIS_REACHES_A_PEER_NOTICE);
    expect(document).not.toContain('noPeerCanAskNotice');
    expect(document).not.toContain('howThisReachesAPeerNotice');
  });

  it('🚫 A FIELD ADDED TO THE VIEW DOES NOT LEAK INTO THE DOCUMENT', () => {
    // ⚠️ The failure this prevents: someone adds a field to the view for the
    // screen's benefit and it silently becomes part of what every peer receives.
    const widened = {
      ...viewFixture(),
      operatorNote: 'a field nobody decided a peer should have',
    } as unknown as ClientContextProjectionView;

    const document = buildClientContextHandover(widened).document;

    expect(document).not.toContain('operatorNote');
    expect(document).not.toContain('a field nobody decided a peer should have');
  });

  it('🚫 NO SCORE CROSSES, and 🚫 no internal capture measure', () => {
    const serialised = buildClientContextHandover(viewFixture()).document.toLowerCase();

    for (const forbidden of [
      'completenessscore',
      'confidencescore',
      'discoverycompleteness',
      'discoveryconfidence',
      'score',
    ]) {
      expect(serialised, forbidden).not.toContain(forbidden);
    }
  });

  it('🚫 CARRIES NO INSTRUCTION — it informs a peer, it 🚫 does not direct one', () => {
    const serialised = buildClientContextHandover(viewFixture()).document.toLowerCase();

    // ADR-0071 §5 refuses "a projection containing an instruction" by name.
    for (const forbidden of ['you should', 'recommend', 'please ', 'action required', 'must now']) {
      expect(serialised, forbidden).not.toContain(forbidden);
    }
  });

  it('⚠️ IS DETERMINISTIC — the same view yields byte-identical bytes', () => {
    const first = buildClientContextHandover(viewFixture());
    const second = buildClientContextHandover(viewFixture());

    expect(first.document).toBe(second.document);
    expect(first.suggestedFileName).toBe(second.suggestedFileName);
    // 🚫 No clock anywhere in the name — an operator's clock is not the answer.
    expect(first.suggestedFileName).toBe('age-client-context-bif-fixture-0001.json');
  });

  it('⚠️ names the BIF it answers for, so two carried files cannot be confused', () => {
    const handover = buildClientContextHandover(viewFixture());

    expect(handover.bifId).toBe('bif-fixture-0001');
    expect(handover.suggestedFileName).toContain('bif-fixture-0001');
  });

  it('🚫 THE MODULE IS PURE — no clock, no network, no persistence', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../client-context-handover.ts', import.meta.url)),
      'utf8',
    );
    // ⚠️ Strip comments first: the file's own explanation of the rule would
    // otherwise match the banned token it explains.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    expect(code.length).toBeGreaterThan(0);
    for (const banned of [
      'new Date(',
      'Date.now(',
      'Math.random(',
      'fetch(',
      'node:fs',
      'process.env',
      '@prisma/client',
      '@age/persistence',
    ]) {
      expect(code, banned).not.toContain(banned);
    }
  });
});
