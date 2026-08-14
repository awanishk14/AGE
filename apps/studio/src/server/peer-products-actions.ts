'use server';

import {
  presentClientContextProjection,
  type ClientContextProjectionView,
} from '@age/studio-shell';

import {
  readClientContextProjection,
  readRelayedObservations,
  type RelayedObservationsOutcome,
} from './operator-environment';

/**
 * The one thing the operator can do on the Peer Products screen: read what has
 * been relayed (ADR-0069 deliverable 6).
 *
 * ⚠️ **AN ACTION, NEVER PAGE DATA.** Reading on open would make opening a screen
 * the act of connecting to the store that holds a real business's relayed
 * observations.
 *
 * 🚫 **THERE IS NO RELAY ACTION HERE, AND THERE MUST NOT BE.** The façade this
 * path is handed carries `listForOrganization` and `close` — no `append`. The
 * relay is a separate, operator-mediated act on a separate path (ADR-0069 D3),
 * and a "just add one" button on a read screen would be that act arriving
 * without its own decision.
 */
export async function readRelayedObservationsAction(
  clientId: string,
): Promise<RelayedObservationsOutcome> {
  return readRelayedObservations(clientId);
}

/**
 * ⚠️ The wire shape of the projection read. The `projected` arm carries the
 * VIEW rather than the raw projection, because a client component must be able
 * to render it without importing the server module.
 */
export type ClientContextProjectionViewOutcome =
  | {
      readonly kind: 'projected';
      readonly view: ClientContextProjectionView;
      readonly organizationId: string;
    }
  /** 🛑 Its own outcome. 🚫 Never an empty subject list. */
  | { readonly kind: 'no-context'; readonly reason: string }
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'refused'; readonly reason: string };

/**
 * What AGE WOULD TELL A PEER, on the operator's press (ADR-0069 deliverable 7).
 *
 * ⚠️ **AN ACTION, NEVER PAGE DATA.** Projecting on open would make opening a
 * screen the act of connecting to the store that holds a real business's
 * captured context.
 *
 * 🛑 **THIS IS NOT THE PEER-FACING SURFACE, AND IT MUST NOT BECOME ONE.** It
 * serves the console operator, who is already at the console. The tool a peer
 * would call — entitled on read — is blocked on token verification (ADR-0068
 * §0.1b), and 🚫 the gap is not closed by exposing this action to anything
 * outside the console: it carries no credential, checks none, and would hand a
 * caller an answer nobody was entitled to.
 *
 * 🛑 **THE ONLY THING DONE TO THE ANSWER IS TO GIVE IT A SHAPE A COMPONENT CAN
 * RENDER**, and `presentClientContextProjection` carries every string through
 * byte-identical. 🚫 Do not re-word, enrich or summarise here — the operator is
 * auditing the peer's answer, not a console paraphrase of it.
 *
 * 🚫 **THERE IS NO WRITE HERE.** The façade this path is handed carries a read
 * and a close; nothing is stored, and a projection is recomputed on every press.
 */
export async function readClientContextProjectionAction(
  clientId: string,
  bifId: string,
): Promise<ClientContextProjectionViewOutcome> {
  const outcome = await readClientContextProjection(clientId, bifId);

  // ⚠️ Every non-`projected` arm travels WHOLE, refusals included — a refusal is
  // a result here, never an exception the screen has to invent words for.
  return outcome.kind === 'projected'
    ? {
        kind: 'projected',
        view: presentClientContextProjection(outcome.projection),
        organizationId: outcome.organizationId,
      }
    : outcome;
}
