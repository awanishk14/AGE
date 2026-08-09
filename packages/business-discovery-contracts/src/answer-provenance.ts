import { z } from 'zod';

/**
 * How an answer was obtained (ADR-0059 D2).
 *
 * ⚠️ WHY THIS EXISTS AT ALL. Assisted intake is authorized (ADR-0059 §0.1d), so
 * from here on an answer in a discovery profile may have been *proposed by a
 * source and accepted by a human* rather than typed by one. Those are different
 * facts about the same sentence, and every downstream number — completeness,
 * confidence, evidence, readiness — is currently labelled "what the business
 * said". Without this field, the label silently becomes false the first time a
 * document is read.
 *
 * 🚫 THERE IS NO VALUE MEANING "EXTRACTED" (D1). Assisted intake **proposes**;
 * it never answers. A candidate that no human accepted is not an answer, so it
 * has nothing to carry a provenance on. If a third arm ever appears here, D1 has
 * been relaxed somewhere else and this is where it shows.
 *
 * 🚫 THERE IS NO DEFAULT, ANYWHERE (D2, ADR-0049 D2). No optional property, no
 * `.default(...)` on the schema, no `provenanceOrStated` helper. A default makes
 * the distinction unfalsifiable behind a field that only *looks* recorded — the
 * exact failure ADR-0049 D2 was written about.
 *
 * 🚫 IT CARRIES NO NUMBER (D3). An extractor's own certainty is a property of a
 * parser; `discoveryConfidenceScore` is a property of the interview. They must
 * never be combined, averaged or substituted, and a numeric field here would be
 * one refactor away from being scored. `answer-provenance.spec.ts` asserts the
 * absence rather than trusting it.
 */

/** A human typed it. */
export interface StatedAnswerProvenance {
  readonly kind: 'stated';
}

/**
 * Proposed by an extraction source and **accepted by a human**.
 *
 * ⚠️ All three properties are required and none is derivable. An accepted
 * candidate that cannot say which source it came from, where inside that source,
 * or who accepted it, is indistinguishable from a fabricated answer — and the
 * whole point of D2 is that the two must never look alike.
 */
export interface ConfirmedFromSourceAnswerProvenance {
  readonly kind: 'confirmed-from-source';
  /** The source's identity, as the surface that read it named it. */
  readonly sourceId: string;
  /**
   * Where inside the source the sentence came from — a page, a line, a heading.
   * ⚠️ Opaque to AGE and never parsed: this records a location, it does not
   * enable re-reading one.
   */
  readonly locator: string;
  /**
   * The human who accepted the candidate.
   *
   * 🚫 Never defaulted, generated or inferred (ADR-0053 D4), and 🚫 never an
   * authorization decision — it records who acted, it decides nothing.
   */
  readonly confirmedBy: string;
}

export type AnswerProvenance = StatedAnswerProvenance | ConfirmedFromSourceAnswerProvenance;

export const statedAnswerProvenanceSchema = z.object({
  kind: z.literal('stated'),
});

export const confirmedFromSourceAnswerProvenanceSchema = z.object({
  kind: z.literal('confirmed-from-source'),
  sourceId: z.string().min(1),
  locator: z.string().min(1),
  confirmedBy: z.string().min(1),
});

export const answerProvenanceSchema = z.discriminatedUnion('kind', [
  statedAnswerProvenanceSchema,
  confirmedFromSourceAnswerProvenanceSchema,
]);

/**
 * The `stated` provenance, as a shared frozen value.
 *
 * ⚠️ A VALUE, NOT A DEFAULT. Every construction site names it explicitly, which
 * is what makes the field falsifiable: a site that forgot to say how its answer
 * was obtained fails to compile rather than quietly claiming a human typed it.
 * 🚫 Do not add a helper that supplies this when a provenance is missing — that
 * helper is the default D2 refuses, wearing a different name.
 */
export const STATED_ANSWER_PROVENANCE: StatedAnswerProvenance = Object.freeze({
  kind: 'stated',
});

/**
 * A one-line, human-facing description of how an answer was obtained.
 *
 * ⚠️ Every arm SAYS SOMETHING. There is no arm that renders as blank, as "—" or
 * as "unknown": a surface that cannot say how an answer was obtained is showing
 * an answer it should not be showing.
 */
export function describeAnswerProvenance(provenance: AnswerProvenance): string {
  if (provenance.kind === 'stated') {
    return 'Stated by a person in the intake.';
  }

  return (
    `Proposed from source "${provenance.sourceId}" at ${provenance.locator}, and accepted by ` +
    `${provenance.confirmedBy}.`
  );
}
