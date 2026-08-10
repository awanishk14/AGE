/**
 * `@age/operator-workspace` — the operator console's nine operations, pure over
 * an injected runtime (ADR-0060 D2).
 *
 * ⚠️ THE CONSOLE'S BEHAVIOUR IS THE ACCEPTANCE CRITERION for this package. It
 * was extracted from `apps/studio/src/server/operator-environment.ts` without a
 * change of behaviour, so that a second surface — `apps/mcp`, over stdio — can
 * call the SAME implementation. 🚫 Duplicating an operation per surface is
 * refused by name in D2.
 *
 * 🚫 NOTHING HERE PERFORMS AN EFFECT, and 🚫 nothing here is a new capability.
 * Adding an operation is a product decision that needs its own ADR — this
 * package is a move, not a widening.
 */

export type { OperatorWorkspaceRuntime } from './operator-workspace-runtime';

export {
  assembleEvidence,
  assessCapabilityReadiness,
  createClientRecord,
  generateBifFromAnswerFile,
  readBusinessesView,
  readDiscoveryDraft,
  reportContradictions,
  resolveBusinessScope,
  submitDiscoveryAnswers,
  writeDiscoveryDraft,
  STUDIO_QUESTIONNAIRE,
  type BusinessScope,
  type CapabilityReadinessOutcome,
  type ContradictionsOutcome,
  type CreateClientOutcome,
  type DiscoveryWorkspaceOutcome,
  type DraftOutcome,
  type EvidenceOutcome,
  type GenerateBifOutcome,
  type SaveOutcome,
  type SubmitOutcome,
} from './operator-workspace';

/**
 * ⚠️ The TENTH operation, added by **ADR-0066 D4** (slice 4) — 🚫 not a widening
 * taken without one. See the module note.
 */
export {
  readOperatorSourceDocument,
  type ReadOperatorSourceDocumentOptions,
  type SourceDocumentOutcome,
} from './source-document';

export {
  narrowSnapshotRead,
  readStoredSnapshot,
  type OpenSnapshotRead,
  type SnapshotReadPort,
  type StoredSnapshotOutcome,
} from './stored-snapshot';
