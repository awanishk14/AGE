import type { ClientContextProjectionView } from './client-context-projection-view';

/**
 * The document an operator CARRIES to a peer product (ADR-0071 D1).
 *
 * 🛑 **THE OPERATOR IS THE TRANSPORT, AND THIS IS WHAT THEY CARRY.** ADR-0071
 * D1 decided that V1 outbound is operator-mediated: no peer credential, no
 * session, no endpoint, no MCP middleware. The projection had no way out of AGE
 * before this module — an operator could read it on a screen and nothing more.
 * This turns the accepted decision into the thing it describes.
 *
 * 🛑 **THE SHAPE IS UNCHANGED BY THE TRANSPORT** (ADR-0071 D5). The document
 * carries exactly the five fields the projection produced and 🚫 NOT ONE MORE.
 * ⚠️ Widening it "since a human is reading it anyway" is a **REFUSAL**, by name
 * in the ADR — a friendlier payload for the operator's eyes is a second answer
 * growing beside the peer's, and the peer's is the one that matters.
 *
 * 🚫 **THE CONSOLE'S OWN SENTENCE NEVER TRAVELS.** `HOW_THIS_REACHES_A_PEER_NOTICE`
 * is a statement about **AGE's surface**, authored for an operator reading a
 * screen. A peer receiving it would be receiving a claim AGE never made about
 * the business. The key set below is **PINNED, NOT FILTERED**, so a field added
 * to the view cannot leak into the document by default.
 *
 * 🚫 **NO INSTRUCTION, EVER** (ADR-0071 §5, refused by name). This document says
 * what AGE models. It 🚫 never says what the peer should do about it — the moment
 * it does, AGE is directing another system rather than informing it.
 *
 * 🚫 **NOTHING IS SENT.** This builds a string. It opens no connection, names no
 * peer and reaches no network. ⚠️ **Producing this is 🚫 NOT evidence that any
 * peer received anything** (ADR-0071 D4) — no peer repository contains AGE code,
 * so nothing has been integrated by a document existing.
 *
 * ⚠️ **PURE and DETERMINISTIC.** No clock, no randomness, no id generation: the
 * same view yields a byte-identical document every time, which is what makes an
 * operator able to diff what they carried against what AGE holds. `asOf` is the
 * projection's stored capture time, carried through — 🚫 never "now".
 */

/** ⚠️ The document, plus what an operator needs to handle it — 🚫 no advice. */
export interface ClientContextHandover {
  /**
   * 🛑 The exact bytes to carry. Deterministic JSON, two-space indented so a
   * human can audit it before pasting it anywhere.
   */
  readonly document: string;
  /** ⚠️ The BIF this answers for, so a carried file can be told from another. */
  readonly bifId: string;
  /** ⚠️ A stable, collision-resistant-enough name. 🚫 No clock in it. */
  readonly suggestedFileName: string;
}

/**
 * 🛑 **PINNED, 🚫 NOT FILTERED.** The five projection fields, in this order.
 * A sixth field appearing on the view does 🚫 NOT reach the document until
 * someone adds it here on purpose — and the spec fails until they do, so the
 * decision cannot be made by accident.
 */
const CARRIED_KEYS = ['bifId', 'asOf', 'subjectKinds', 'notCaptured', 'notices'] as const;

/**
 * @param view as `presentClientContextProjection` produced it. ⚠️ Every value is
 *   carried through unchanged; 🚫 nothing is re-worded, re-ordered or dropped.
 */
export function buildClientContextHandover(
  view: Readonly<ClientContextProjectionView>,
): ClientContextHandover {
  // ⚠️ Built key-by-key in the pinned order rather than by spreading the view:
  // a spread would carry a newly added field silently, which is the one thing
  // this module exists to prevent.
  const carried: Record<string, unknown> = {};
  for (const key of CARRIED_KEYS) {
    carried[key] = view[key];
  }

  return {
    document: `${JSON.stringify(carried, null, 2)}\n`,
    bifId: view.bifId,
    // 🚫 No date in the name — the operator's clock is not part of the answer.
    suggestedFileName: `age-client-context-${view.bifId}.json`,
  };
}
