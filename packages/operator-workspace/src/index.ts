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
  composeIntakeChannels,
  STUDIO_QUESTIONNAIRE,
  type BusinessScope,
  type ComposedIntake,
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
  type OperatorDocumentDecoder,
  type ReadOperatorSourceDocumentOptions,
  type SourceDocumentOutcome,
} from './source-document';

/**
 * ⚠️ The FOURTEENTH and FIFTEENTH operations, added by **ADR-0073** — reading
 * and recording the confirmations a human accepted from a source, in the
 * operator's OWN workspace.
 *
 * 🛑 **READ, RECORD, WRITE — AND THE READ IS LOAD-BEARING.** Without it the
 * duplicate refusal never fires and each confirmation starts from nothing, which
 * is the exact defect this pair replaces. 🚫 `@age/intake-draft` still persists
 * nothing, and 🚫 nothing here is canonical: these answers reach a profile only
 * through the same explicit path the answer file uses.
 */
export {
  readSourceConfirmations,
  recordSourceConfirmation,
  type RecordSourceConfirmationOptions,
  type RecordSourceConfirmationOutcome,
  type SourceConfirmationsOutcome,
} from './source-confirmed-draft';

export {
  narrowSnapshotRead,
  readStoredSnapshot,
  type OpenSnapshotRead,
  type SnapshotReadPort,
  type StoredSnapshotOutcome,
} from './stored-snapshot';

/**
 * ⚠️ The ELEVENTH operation, added by **ADR-0069** — reading what peer products
 * have OBSERVED. 🚫 It cannot relay, record or believe one.
 */
export {
  NONE_RELAYED_REASON,
  narrowObservationRead,
  readRelayedObservations,
  type ObservationReadPort,
  type OpenObservationRead,
  type RelayedObservationsOutcome,
} from './relayed-observations';

/**
 * ⚠️ The TWELFTH operation, added by **ADR-0069** — reading what AGE CONCLUDES.
 *
 * 🛑 The only one that reads TWO stores, and 🛑 the only one whose empty answer
 * has to be told apart from its never-ran answer: no stored context means the
 * derivation NEVER RAN, and that is its own outcome. 🚫 It concludes nothing
 * itself and 🚫 persists nothing.
 */
export { readDerivedIntelligence, type DerivedIntelligenceOutcome } from './derived-intelligence';

/**
 * ⚠️ The THIRTEENTH operation, added by **ADR-0069** — reading WHAT AGE WOULD
 * TELL A PEER, so the operator can audit the peer's answer rather than a
 * description of it.
 *
 * 🛑 It calls the SAME `projectClientContext` the peer-facing tool will call and
 * 🚫 rewords nothing. 🛑 It opens ONE store — the observation store is not
 * needed and 🚫 must not be mixed in. 🛑 No peer can actually ask yet: the tool
 * is blocked on token verification (ADR-0068 §0.1b), and the surface must say
 * so rather than let the operator assume peers are being served.
 */
export {
  readClientContextProjection,
  type ClientContextProjectionOutcome,
} from './client-context-projection';
