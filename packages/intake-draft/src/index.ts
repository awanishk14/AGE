/**
 * `@age/intake-draft` — ADR-0066 **D4** (§0.5, §0.5a): the working intake record
 * where a `confirmed-from-source` answer may live, because the Answer File
 * structurally cannot hold one and 🚫 must not learn to.
 *
 * 🛑 **WHAT THIS PACKAGE MUST NEVER GROW:**
 * - 🚫 **A canonical read.** No scorer, BIF mapper, capability or screen may
 *   take a draft in place of the profile the acceptance path produces. The draft
 *   is a working artifact; `Draft → everything` is the shadow database §0.5a
 *   refuses.
 * - 🚫 **Persistence of any kind** — no store, no repository, no schema, no
 *   migration, no RLS. That is a separate decision the owner explicitly kept out
 *   of D4, and it needs its own `Proposed` ADR.
 * - 🚫 **Anything that reads provenance to decide something.** Provenance may
 *   live here; it may never count here (AGE-INV-PROV-1, ADR-0066 §0.3c).
 * - 🚫 **A silent overwrite** of an existing answer — that discards a recorded
 *   origin, and replacement is its own decision.
 */

export {
  DraftRecordingRefusedError,
  answerFor,
  draftAnswers,
  emptyIntakeDraft,
  intakeDraftSchema,
  recordAnswerInDraft,
} from './intake-draft';
export type { IntakeDraft } from './intake-draft';
