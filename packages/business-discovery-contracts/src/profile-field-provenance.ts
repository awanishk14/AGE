import { z } from 'zod';

import { answerProvenanceSchema, type AnswerProvenance } from './answer-provenance';
import {
  EVIDENCEABLE_FIELD_PATHS,
  evidenceableFieldPathSchema,
  type EvidenceableFieldPath,
} from './field-provenance';

/**
 * ProfileFieldProvenance — where each structured profile field's value CAME
 * FROM, on a channel the scorers cannot see (ADR-0066 D2, accepted 2026-08-09).
 *
 * 🛑 THIS IS NOT `fieldEvidence`, AND IT MUST NEVER BECOME IT. `fieldEvidence`
 * is read by `completeness-scoring.ts` (evidenced sections escape the uncited
 * cap) and by `business-discovery-to-bif.ts` (it decides each field's
 * `FieldSource`). Writing provenance there would move a score, which is exactly
 * the thing D2 refuses.
 *
 * ⚠️ AGE-INV-PROV-1 (ADR-0066 §0.3c) — **identical profile facts with different
 * provenance MUST produce byte-identical scoring and BIF results.** The
 * invariant is protected structurally as well as by test: this type has NO SLOT
 * ON ANY PROFILE TYPE. It is a SECOND RETURN VALUE of
 * `buildProfileAndFieldProvenanceFromAnswers`, so a scorer that takes a profile
 * cannot reach it even by accident, and adding a scorer parameter for it would
 * be a visible, reviewable act rather than a silent one.
 *
 * In the Product Owner's words: *"Provenance tells AGE where a fact came from.
 * It does not tell AGE how true the fact is."* — `SOURCE ≠ EVIDENCE ≠
 * CONFIDENCE`.
 *
 * 🚫 IT CARRIES NO NUMBER (ADR-0059 D3, ADR-0066 D3). No score, no weight, no
 * confidence, no count — a number here would be read as a degree of belief the
 * moment anything rendered it, and the only permitted sentence about scoring is
 * **"Provenance alone never changes a score."** 🚫 Never write *"a document can
 * never raise a score"*: a future ADR may decide that a source's CONTENT is
 * evidence, explicitly, and never as a side effect of a provenance record
 * existing (ADR-0066 §0.3a).
 *
 * 🚫 A client-typed answer is NOT less trustworthy for having no document behind
 * it. The asymmetry runs both ways: extraction does not promote, and typing does
 * not demote.
 *
 * Pure data plus pure lookups. No clock, no I/O, no randomness.
 */

/**
 * One structured field's origin: which question produced it, and how that
 * question's answer reached AGE.
 *
 * ⚠️ Field-level, not item-level — the same granularity as
 * `EVIDENCEABLE_FIELD_PATHS`, for the same reason (index-based paths break under
 * reordering).
 */
export interface ProfileFieldProvenanceEntry {
  readonly fieldPath: EvidenceableFieldPath;
  /** The questionnaire question whose answer was transcribed into the field. */
  readonly questionId: string;
  /** How that answer reached AGE. 🚫 Never defaulted — it is required on `DiscoveryAnswer`. */
  readonly provenance: AnswerProvenance;
}

/**
 * The provenance channel for one profile.
 *
 * `profileId` is carried so a channel can never be silently matched to the wrong
 * profile: the two values travel together, and a caller that stores them apart
 * can still tell whether they belong together.
 *
 * ⚠️ A field with no entry is **not-recorded**, which is neither "stated" nor
 * "confirmed". 🚫 Do not default an absent entry to `STATED_ANSWER_PROVENANCE`:
 * that would assert the client said something they may never have been asked.
 */
export interface ProfileFieldProvenance {
  readonly profileId: string;
  /** Questionnaire order, mirroring the profile the same traversal produced. */
  readonly entries: readonly ProfileFieldProvenanceEntry[];
}

export const profileFieldProvenanceEntrySchema = z.object({
  fieldPath: evidenceableFieldPathSchema,
  questionId: z.string().min(1),
  provenance: answerProvenanceSchema,
});

export const profileFieldProvenanceSchema = z.object({
  profileId: z.string().min(1),
  entries: z.array(profileFieldProvenanceEntrySchema),
});

/**
 * Every entry recorded for one field path, in questionnaire order.
 *
 * A field may have more than one — two questions legitimately target
 * `offerings`, one per `OfferingKind` (ADR-0051 D1–D4) — and the entries are
 * kept SEPARATE rather than merged. 🚫 Two sources are two labels, never one
 * summarised label and never a diff (ADR-0066 D5).
 */
export function fieldProvenanceEntriesFor(
  channel: ProfileFieldProvenance,
  fieldPath: EvidenceableFieldPath,
): readonly ProfileFieldProvenanceEntry[] {
  return channel.entries.filter((entry) => entry.fieldPath === fieldPath);
}

/**
 * The field paths this channel records an origin for, in declaration order.
 *
 * ⚠️ Deliberately NOT named `getEvidencedFieldPaths` and deliberately not
 * shaped like it. That function feeds scoring; this one must never be mistaken
 * for it at a call site, so it shares neither its name nor its module.
 */
export function fieldPathsWithRecordedProvenance(
  channel: ProfileFieldProvenance,
): readonly EvidenceableFieldPath[] {
  const recorded = new Set(channel.entries.map((entry) => entry.fieldPath));
  return EVIDENCEABLE_FIELD_PATHS.filter((fieldPath) => recorded.has(fieldPath));
}
