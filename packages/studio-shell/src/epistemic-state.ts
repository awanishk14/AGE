/**
 * The four epistemic states, from `17_DESIGN_SYSTEM.md` §4.
 *
 * ⚠️ These are FOUR states, not two, and 🚫 they must never share a visual
 * treatment. Collapsing any pair is the specific way this product lies:
 *
 *  - **known** — a value, and a source it can be attributed to.
 *  - **unattributed** — a value, with no source. 🚫 Not the same as known.
 *  - **unknown** — AGE looked and there is nothing. ⚠️ A correct, final answer,
 *    and it is styled as a result, never as a failure.
 *  - **not assessed** — AGE has not looked. 🚫 NEVER rendered as zero, as empty,
 *    or as a low score. `sufficiency === undefined` is THIS state; 🚫 it is
 *    never defaulted to `ready`.
 *
 * 🚫 Colour never encodes a state alone. Each carries a distinct glyph, a
 * distinct border style and a distinct written label, so the distinction
 * survives greyscale, colour-blindness and a screenshot in a slide deck.
 */
export type EpistemicState = 'known' | 'unattributed' | 'unknown' | 'not-assessed';

export interface EpistemicStatePresentation {
  readonly state: EpistemicState;
  /** The words shown to the operator. 🚫 Never abbreviated away. */
  readonly label: string;
  /** The CSS modifier carrying glyph, border style and colour together. */
  readonly className: string;
  /** What the state means, for a title attribute or a legend. */
  readonly meaning: string;
}

const PRESENTATIONS: Readonly<Record<EpistemicState, EpistemicStatePresentation>> = Object.freeze({
  known: {
    state: 'known',
    label: 'Known',
    className: 'age-state age-state--known',
    meaning: 'AGE has a value and a source it can point at.',
  },
  unattributed: {
    state: 'unattributed',
    label: 'Unattributed',
    className: 'age-state age-state--unattributed',
    meaning: 'AGE has a value but cannot say where it came from.',
  },
  unknown: {
    state: 'unknown',
    label: 'Unknown',
    className: 'age-state age-state--unknown',
    meaning: 'AGE looked and there is nothing here. This is a result, not a failure.',
  },
  'not-assessed': {
    state: 'not-assessed',
    label: 'Not assessed',
    className: 'age-state age-state--not-assessed',
    meaning: 'AGE has not looked yet. This is not zero and not empty.',
  },
});

export const EPISTEMIC_STATES: readonly EpistemicState[] = Object.freeze([
  'known',
  'unattributed',
  'unknown',
  'not-assessed',
]);

export function presentEpistemicState(state: EpistemicState): EpistemicStatePresentation {
  return PRESENTATIONS[state];
}

export function allEpistemicStatePresentations(): readonly EpistemicStatePresentation[] {
  return EPISTEMIC_STATES.map(presentEpistemicState);
}
