import {
  acceptSourceObservationEnvelope,
  type EnvelopeRefusal,
  type SourceObservationEnvelope,
} from './observation-envelope';

/**
 * The relay — ADR-0069 D3, deliverable 3.
 *
 * 🛑 **A RELAY CARRIES; IT DOES NOT KEEP.** This module accepts what a peer
 * product observed, checks it, and hands it back. 🚫 It records nothing, and the
 * store it would record into is not reachable from here: the transport that
 * calls this is MCP over stdio, and `apps/mcp` opens no database at all
 * (ADR-0055 D6). Appending is the operator's OWN act, out of band, exactly as
 * the first capture write was required to be (ADR-0060 §6 Q1, still unanswered —
 * 🚫 and this slice does not answer it).
 *
 * 🚫 **THERE IS NO LISTENER, NO ENDPOINT, NO SCHEDULER AND NO POLL.** A peer
 * product does not connect to AGE. An operator carries one observation across,
 * one call at a time. 🚫 Do not add a bulk arm, a queue, a retry, a cursor or a
 * "sync" — each of them turns this into the ingestion layer ADR-0069 exists to
 * avoid, and each arrives looking like a convenience.
 *
 * 🛑 **RELAYED IS NOT RECORDED, AND RELAYED IS NOT BELIEVED** (ADR-0069 D5).
 * Source arrival is never confirmation. The outcome says so in a field a reader
 * cannot miss and cannot read as a falsy nothing, because a model consuming this
 * result will otherwise assume that a well-formed observation which was not
 * refused must therefore be held.
 *
 * ⚠️ **ADMISSIBILITY IS DELIBERATELY NOT ASSESSED HERE.** Whether an observation
 * names a subject AGE models (D4) can only be answered against the real business
 * context, and this surface has none: it is not tenant-scoped, takes no
 * `clientId`, and reads nothing (ADR-0066 D7, uncrossed BY SHAPE and not by
 * promise). 🚫 The answer is reported as **not assessed, with its reason** —
 * 🚫 never as `admissible`, never as `false`, never as an omitted field, and
 * 🚫 never guessed from an empty subject list, which would render "AGE has never
 * looked" as "AGE looked and found nothing".
 *
 * 🚫 **SOURCE-NEUTRAL** (D6). No peer product is named anywhere in this module,
 * and `sourceSystem` is never branched on. A third-party system AGE has never
 * heard of relays through exactly this path.
 *
 * Pure: no clock, no ids, no randomness, no I/O.
 */

/** Why admissibility has no answer yet. ⚠️ A REASON, 🚫 never a verdict. */
export const RELAY_ADMISSIBILITY_NOT_ASSESSED =
  'Admissibility is assessed against the business AGE models, and this surface holds no business ' +
  'context. It has NOT been assessed here — this is not a finding that the observation is ' +
  'inadmissible, and not a finding that it is admissible.';

/** Why nothing was stored. ⚠️ A DECISION, 🚫 never a failure. */
export const RELAY_DOES_NOT_RECORD =
  'A relay carries; it does not keep. This call stored nothing. Appending an observation is the ' +
  'operator’s own act, performed out of band — it is deliberately not something this surface can do.';

/**
 * ⚠️ A `type`, 🚫 not an `interface`, and deliberately: the MCP surface
 * serialises an outcome WHOLE through a `Record<string, unknown>` parameter, and
 * an `interface` has no implicit index signature. 🚫 Do not "fix" that at the
 * call site with a cast — a cast there is where a field starts being lifted out.
 */
export type RelayRelayed = {
  readonly kind: 'relayed';
  /** ⚠️ The envelope AGE read, 🚫 not the input as sent. Nothing was repaired. */
  readonly envelope: SourceObservationEnvelope;
  /**
   * 🛑 Present, explicit and always `false`. 🚫 Never omitted when false — an
   * absent key reads as "presumably fine" to the next thing that touches it.
   */
  readonly recorded: false;
  readonly recordedReason: typeof RELAY_DOES_NOT_RECORD;
  /**
   * 🛑 `not-assessed` is an ANSWER, and it carries its reason. 🚫 It is never
   * `null`, `false`, `0`, `"none"` or an omitted key.
   */
  readonly admissibility: {
    readonly state: 'not-assessed';
    readonly reason: typeof RELAY_ADMISSIBILITY_NOT_ASSESSED;
  };
};

export type RelayRefused = {
  readonly kind: 'refused';
  readonly reason: EnvelopeRefusal['reason'];
  /** A dotted path. 🚫 Never a value, never the organisation, never a client id. */
  readonly position: string;
};

export type RelayOutcome = RelayRelayed | RelayRefused;

/**
 * Relays ONE observation from ONE peer product.
 *
 * 🚫 **ONE, AND THERE IS NO SECOND ARM.** A bulk relay is how fifty thousand
 * rows arrive, and the shape of this signature is the only thing standing
 * between AGE and a data warehouse (ADR-0069 D4's reasoning).
 *
 * @param input untrusted. It came from outside AGE and 🚫 nothing about it is
 *   believed until `acceptSourceObservationEnvelope` has checked it.
 */
export function relaySourceObservation(input: unknown): RelayOutcome {
  const acceptance = acceptSourceObservationEnvelope(input);

  if (acceptance.outcome === 'refused') {
    return { kind: 'refused', reason: acceptance.reason, position: acceptance.position };
  }

  return {
    kind: 'relayed',
    envelope: acceptance.envelope,
    recorded: false,
    recordedReason: RELAY_DOES_NOT_RECORD,
    admissibility: {
      state: 'not-assessed',
      reason: RELAY_ADMISSIBILITY_NOT_ASSESSED,
    },
  };
}
