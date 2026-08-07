import {
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE,
  PROFILE_SIGNALS,
  type BusinessDiscoveryQuestionnaireQuestion,
} from '@age/business-discovery-contracts';
import { describe, expect, it } from 'vitest';

import { EXPLAINED_SIGNALS, rationaleFor } from './discovery-rationale';

const QUESTIONS: readonly BusinessDiscoveryQuestionnaireQuestion[] =
  DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE.sections.flatMap((section) => section.questions);

describe('rationaleFor', () => {
  it('explains every profile signal, and no signal it does not route', () => {
    // ⚠️ The drift guard. A signal added to the contracts package without an
    // entry here would render an EMPTY explanation on the operator's screen —
    // silently, and only for the new question.
    expect(EXPLAINED_SIGNALS).toEqual([...PROFILE_SIGNALS].sort());
  });

  it('found questions to check', () => {
    // Without this, every assertion below would pass over an empty list.
    expect(QUESTIONS.length).toBeGreaterThan(10);
  });

  it('explains every question that declares a route into the profile', () => {
    const routed = QUESTIONS.filter((question) => question.satisfiedBy !== undefined);
    expect(routed.length).toBeGreaterThan(10);

    let examined = 0;
    for (const question of routed) {
      examined += 1;
      const rationale = rationaleFor(question);
      expect(rationale, `question "${question.id}" has no rationale`).toBeDefined();
      expect(rationale?.feeds.length).toBeGreaterThan(0);
      expect(rationale?.ifBlank.length).toBeGreaterThan(0);
      expect(rationale?.profileField.length).toBeGreaterThan(0);
    }
    expect(examined).toBe(routed.length);
  });

  it('says nothing about a shipped question that routes nowhere', () => {
    /**
     * ⚠️ `ev-assumptions` is real and declares no `satisfiedBy`. It asks what
     * remains unknown — an answer that is recorded but populates no structured
     * profile field, so there is no true sentence about what it feeds.
     *
     * 🚫 The screen renders no explanation for it rather than a plausible one.
     * This test exists because the first version of the module's own guard
     * assumed every shipped question was routed, and it is not.
     */
    const unrouted = QUESTIONS.filter((question) => question.satisfiedBy === undefined);
    expect(unrouted.map((question) => question.id)).toContain('ev-assumptions');

    for (const question of unrouted) {
      expect(rationaleFor(question)).toBeUndefined();
    }
  });

  it('names the profile field the mapper actually routes to, not a copy of it', () => {
    // The field must come from PROFILE_SIGNAL_TARGETS so a rename cannot leave a
    // stale name on the screen. `bi-name` routes to `businessName`.
    const question = QUESTIONS.find((q) => q.satisfiedBy === 'businessName');
    expect(rationaleFor(question as BusinessDiscoveryQuestionnaireQuestion)?.profileField).toBe(
      'businessName',
    );
  });

  it('invents no explanation for a question that declares no signal', () => {
    // 🚫 The whole point: no route into the profile means nothing true to say.
    const unrouted = {
      ...(QUESTIONS[0] as BusinessDiscoveryQuestionnaireQuestion),
      satisfiedBy: undefined,
    };

    expect(rationaleFor(unrouted)).toBeUndefined();
  });

  it('never promises a benefit or implies a score', () => {
    // ⚠️ These sentences sit next to a field an operator fills in about their
    // own business. Persuasion here would be AGE selling rather than explaining,
    // and a score word would collide with `discoveryCompletenessScore`.
    /**
     * ⚠️ MATCHED ON WORD BOUNDARIES, NOT AS SUBSTRINGS. The first version of
     * this test scanned with `toContain` and failed on the word "already",
     * which contains "ready" — the same false-positive class the repo's
     * comment-stripping rule exists for. A guard that cries wolf gets relaxed.
     */
    const banned = ['better', 'improve', 'improves', 'boost', 'score', 'scores', 'ready'];
    let examined = 0;

    for (const question of QUESTIONS) {
      const rationale = rationaleFor(question);
      const words = new Set(
        `${rationale?.feeds ?? ''} ${rationale?.ifBlank ?? ''}`.toLowerCase().split(/[^a-z]+/),
      );
      examined += 1;
      for (const word of banned) {
        expect(words.has(word), `question "${question.id}" says "${word}"`).toBe(false);
      }
    }

    expect(examined).toBe(QUESTIONS.length);
  });
});
