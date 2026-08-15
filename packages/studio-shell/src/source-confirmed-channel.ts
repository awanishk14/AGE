import type { EpistemicState } from './epistemic-state';

/**
 * The SECOND intake channel, as a screen may state it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ WHY THIS MODULE EXISTS. ADR-0073 gave source-confirmed answers a durable
 * home of their own, and every screen that had been written when there was only
 * one channel went on speaking as though there still were. A business with three
 * confirmed answers and nothing typed was reported as *"Nothing saved yet — the
 * console looked where it was told to look and found no saved draft"*, which is
 * true of the Answer File and false of the operator's work. ⚠️ A screen claiming
 * AGE holds nothing when it holds something is the same class of dishonesty as
 * one claiming a capability that does not exist.
 *
 * 🛑 THE TWO CHANNELS STAY TWO (ADR-0073 D2/D5). 🚫 Nothing here adds a
 * confirmation to a typed answer, produces a combined count, or reports one as a
 * share of the other. The count below is a count of ONE file's entries and is
 * 🚫 never a completeness, a score or a percentage.
 *
 * 🚫 AND IT IS NEVER A CLAIM ABOUT THE BUSINESS. `none-confirmed` is *no answer
 * has been confirmed from a document*, 🚫 never *this business has little to
 * tell* — the same rule the typed-draft arm has always carried.
 *
 * Pure: no clock, no ids, no randomness, no I/O.
 */

/**
 * What the caller found when it looked for this business's CONFIRMED answers.
 *
 * ⚠️ THREE ARMS, AND THEY ARE NOT INTERCHANGEABLE. `not-configured` means AGE
 * never had a place to look; `refused` means it looked and could not proceed;
 * `read` means it looked and can say how many entries the file carries — which
 * may be none. 🚫 Collapsing them into a boolean would turn "AGE has not
 * looked" into "nothing has been confirmed".
 */
export type SourceConfirmedPresence =
  | { readonly kind: 'not-configured' }
  | { readonly kind: 'refused' }
  | { readonly kind: 'read'; readonly questionCount: number };

/** One statement about the confirmed-answers channel. Never about the business. */
export interface SourceConfirmedChannelView {
  readonly label: string;
  readonly value: string;
  readonly state: EpistemicState;
  readonly detail: string;
}

export const SOURCE_CONFIRMED_LABEL = 'Answers confirmed from documents';

/**
 * ⚠️ Said wherever a count appears, and 🚫 not as a footnote. Without it, "3
 * confirmed" next to "0 of 17 answered" reads as one progress figure disagreeing
 * with another rather than as two channels measuring different things.
 */
export const SOURCE_CONFIRMED_SEPARATION_NOTE =
  'These are counted separately from what you typed and are never added to it. ' +
  'The two are different acts — one is your own statement, the other is a document’s ' +
  'sentence you accepted — and AGE keeps them apart everywhere, including here.';

/**
 * What every action panel that composes the two channels says it reads.
 *
 * ⚠️ THE PANELS USED TO SAY "the answer file this console wrote", and that was
 * true until ADR-0073 D5 made the BIF read BOTH channels. A screen that
 * understates its input is not a small inaccuracy here: the BIF it produces
 * cites fields the screen said it would not have looked at, and the operator has
 * no way to tell whether that came from a document or from a bug.
 *
 * 🚫 ONE IMPLEMENTATION. Four panels render this sentence; four copies of it is
 * three that will not be updated the next time a channel is added.
 */
export const BOTH_INTAKE_CHANNELS_READ =
  'This reads both intake channels for this business — the answers you typed and the answers ' +
  'you confirmed from documents — and keeps their origins apart';

export function presentSourceConfirmedChannel(
  presence: SourceConfirmedPresence,
): SourceConfirmedChannelView {
  switch (presence.kind) {
    case 'not-configured':
      return Object.freeze({
        label: SOURCE_CONFIRMED_LABEL,
        value: 'Not looked for',
        state: 'not-assessed' as EpistemicState,
        detail:
          'No workspace was configured, so the console has not looked for confirmed answers at ' +
          'all. This is not "none confirmed" — nothing has looked.',
      });
    case 'refused':
      return Object.freeze({
        label: SOURCE_CONFIRMED_LABEL,
        value: 'Refused',
        state: 'unknown' as EpistemicState,
        detail:
          'The console tried to read this business’s confirmed answers and refused to proceed. ' +
          'The Sources area states why. No partial or repaired file is used in its place.',
      });
    case 'read':
      // ⚠️ Zero is its own sentence. 🚫 It is not the same as never having
      // looked, and 🚫 it says nothing about how much the business has to tell.
      return presence.questionCount === 0
        ? Object.freeze({
            label: SOURCE_CONFIRMED_LABEL,
            value: 'None yet',
            state: 'unknown' as EpistemicState,
            detail:
              'The console looked where it was told to look and no answer has been confirmed ' +
              'from a document for this business. That is a fact about the capture, not about ' +
              'the business.',
          })
        : Object.freeze({
            label: SOURCE_CONFIRMED_LABEL,
            value:
              presence.questionCount === 1
                ? '1 question answered from a document'
                : `${String(presence.questionCount)} questions answered from a document`,
            state: 'known' as EpistemicState,
            detail:
              'Each was proposed by a document and accepted by a named operator, and the Sources ' +
              `area lists which. ${SOURCE_CONFIRMED_SEPARATION_NOTE}`,
          });
  }
}
