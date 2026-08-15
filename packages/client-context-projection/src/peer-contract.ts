import type { SourceObservationEnvelope } from '@age/source-observation';

import type { ClientContextProjection } from './projection';

/**
 * `age.peer.v1` — the named, versioned contract between AGE and a peer product.
 *
 * 🛑 **THIS IS A DOCUMENT FORMAT, 🚫 NOT A SHARED LIBRARY.** A peer product
 * lives in its own repository and cannot import `@age/*` — those packages are
 * TS-source ESM resolved through this workspace and are published nowhere. So
 * the coupling between AGE and a peer is a **file on the operator's disk**, and
 * conformance is proven by AGE's own acceptance path accepting it — 🚫 never by
 * two sides importing the same type and calling that agreement.
 *
 * 🛑 **SOURCE-NEUTRAL, BY CONSTRUCTION** (ADR-0069 D6). No peer product is named
 * in this module, no field is special to one consumer, and there is no per-peer
 * arm. It was extracted from the first peer integration precisely so the second
 * one does not get an architecture of its own.
 *
 * ⚠️ **THE TWO DIRECTIONS ARE DELIBERATELY NOT SYMMETRICAL, AND HERE IS WHY.**
 *
 * - **Outbound** (AGE → peer) is a **wrapped** document: the projection under a
 *   contract marker. Nothing shipped consumes it yet, so it can carry its own
 *   version, and a peer reading a projection must be able to tell which contract
 *   produced it before it acts on the labels.
 * - **Inbound** (peer → AGE) is a **bare `SourceObservationEnvelope`**, because
 *   that is already the shipped shape `age-capture relay --observation` reads
 *   and validates. 🚫 Wrapping it would mean editing the one write path into the
 *   observation store to satisfy a document format, which is the tail wagging
 *   the dog. The contract **adopts** the existing shape rather than replacing
 *   it, and 🚫 no version marker is added to the inbound file: a marker nothing
 *   reads is a promise, not a check, and this repository has a rule about those.
 *
 * 🚫 **NO TRANSPORT LIVES HERE.** No fetch, no listener, no client, no
 * credential. The operator carries both documents (ADR-0071 D1). Adding a
 * transport to this module would be the peer protocol ADR-0071 D3 explicitly
 * left unresolved.
 *
 * Pure: no clock, no ids, no randomness, no I/O.
 */

/**
 * The contract identifier both sides write and check.
 *
 * ⚠️ **THE VERSION IS PART OF THE VALUE, 🚫 NOT A SEPARATE FIELD.** A peer that
 * reads `contract` and compares it to a constant cannot accidentally accept a
 * `v2` document by ignoring a number it did not know to look at.
 */
export const AGE_PEER_CONTRACT = 'age.peer.v1';

/**
 * Which of the contract's documents this is.
 *
 * ⚠️ Named even though there is currently one wrapped document, so that a second
 * one cannot be told apart from the first only by which fields happen to parse.
 */
export const PEER_CONTEXT_DOCUMENT = 'client-context-projection';

export interface PeerContextDocument {
  readonly contract: typeof AGE_PEER_CONTRACT;
  readonly document: typeof PEER_CONTEXT_DOCUMENT;
  /**
   * The projection, verbatim.
   *
   * 🚫 **NOT FLATTENED INTO THE WRAPPER.** A peer that reads `labels` off the
   * top level would lose the state and the `because` that sit beside them, which
   * is exactly how `never-captured` starts being read as "none" (ADR-0069 D5).
   */
  readonly projection: ClientContextProjection;
}

/**
 * Wraps a projection as the contract's outbound document.
 *
 * 🚫 It adds nothing, drops nothing and reorders nothing. Whatever
 * `projectClientContext` decided is what a peer receives.
 */
export function asPeerContextDocument(projection: ClientContextProjection): PeerContextDocument {
  return {
    contract: AGE_PEER_CONTRACT,
    document: PEER_CONTEXT_DOCUMENT,
    projection,
  };
}

/**
 * The inbound document, restated under the contract's name.
 *
 * ⚠️ **AN ALIAS, 🚫 NOT A NEW TYPE.** It exists so that a reader of this module
 * can see both halves of the contract in one place without either half acquiring
 * a second definition. 🛑 The authority on what is admissible remains
 * `acceptSourceObservationEnvelope` in `@age/source-observation` — 🚫 there is
 * no second validator here, and a peer's document is admissible because that
 * function accepted it, never because it matched this type.
 */
export type PeerObservationDocument = SourceObservationEnvelope;
