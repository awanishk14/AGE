/**
 * `@age/studio-shell` — the testable logic behind the AGE Studio shell.
 *
 * ⚠️ This package holds decisions; `apps/studio` renders them. That split is the
 * ADR-0048 D4 precedent: logic that has rules lives below the rendering layer so
 * it can be tested without a browser. 🚫 Do not move any of this into a
 * component, and 🚫 do not let a component grow a second copy of a rule.
 *
 * 🚫 Nothing here reads a database, a file or the network. The shell is honest
 * about knowing nothing yet, rather than looking complete and being empty.
 */

export {
  assertLoopbackBindHost,
  DEFAULT_STUDIO_BIND_HOST,
  loopbackHosts,
  StudioBindRefusedError,
} from './loopback-policy';

export {
  allEpistemicStatePresentations,
  EPISTEMIC_STATES,
  presentEpistemicState,
  type EpistemicState,
  type EpistemicStatePresentation,
} from './epistemic-state';

export {
  areaByRoute,
  areaHref,
  areaNeedsClientId,
  areasForLevel,
  businessProfileHref,
  CLIENT_ID_PARAMETER,
  everyAreaIsUnwired,
  matchAreaRoute,
  MissingClientScopeError,
  REFUSED_AREAS,
  STUDIO_AREAS,
  SUBJECT_ROUTE_PREFIX,
  type AreaLevel,
  type AreaWiring,
  type MatchedRoute,
  type StudioArea,
} from './navigation';

export {
  presentBusinessProfile,
  type DiscoveryDraftPresence,
  type BusinessIdentityInput,
  type BusinessProfileInput,
  type BusinessProfileView,
  type CaptureStatusView,
  type IdentityFactView,
  type ProfileAreaView,
} from './business-profile-view';

export {
  CLIENT_RECORD_FILE_VARIABLE,
  resolveClientRecordSource,
  type ClientRecordSource,
} from './client-record-source';

export {
  countBusinesses,
  groupIntoOrganizationBands,
  presentBusinesses,
  type BusinessesView,
  type OrganizationBand,
} from './businesses-view';

export {
  applyDraftAnswer,
  applyDraftSkip,
  canSubmit,
  draftFromFormEntries,
  fieldValueOf,
  isDiscoverySkipReason,
  skipReasonOf,
  summarizeDiscoverySections,
  DISCOVERY_SKIP_FIELD_PREFIX,
  DISCOVERY_SKIP_REASONS,
  DiscoveryDraftError,
  emptyDraft,
  isListQuestion,
  parseDiscoveryDraft,
  renderAnswerFile,
  renderDiscoveryDraft,
  summarizeDiscoveryProgress,
  validateDraft,
  type DiscoveryDraft,
  type DiscoveryDraftValue,
  type DiscoveryProgress,
  type DiscoverySectionProgress,
  type DiscoverySkipReason,
  type DraftValidation,
} from './discovery-draft';

export { rationaleFor, EXPLAINED_SIGNALS, type QuestionRationale } from './discovery-rationale';

export {
  fieldStateOf,
  presentGeneratedBif,
  renderFieldValue,
  storedHistoryFacets,
  type BifFieldView,
  type BifOmittedSectionView,
  type BifScoreSet,
  type BifSectionView,
  type BifUnmappedFieldView,
  type GeneratedBifView,
  type StoredHistoryFacet,
} from './bif-view';

// ⚠️ Per-BIF-field origin (ADR-0066 D6, slice 5). 🚫 The two origins of one
// field are never merged, and an absent one is `not-recorded` — never `stated`.
export {
  PRODUCED_FROM_ANSWER_FILE,
  PROVENANCE_NEVER_CHANGES_A_SCORE,
  presentBifFieldSources,
  type BifFieldOriginView,
  type BifFieldSourceView,
  type BifSectionSourceView,
} from './bif-field-source-view';

export {
  dashboardCoverage,
  presentDashboard,
  type AreaCoverageRow,
  type DashboardPanel,
  type DashboardView,
} from './dashboard-view';

export {
  presentContradictions,
  type ContradictionPreconditionView,
  type ContradictionsNotAssessedFacet,
  type ContradictionsView,
} from './contradictions-view';

export {
  evidenceNotAssessedFacets,
  presentEvidence,
  type BeliefSupportView,
  type EvidenceNotAssessedFacet,
  type EvidenceView,
  type NamedEvidenceView,
  type RecordedAnswerView,
} from './evidence-view';

export {
  intelligenceNotAssessedFacets,
  presentCapabilityReadiness,
  type CapabilityReadinessRowView,
  type CapabilityReadinessView,
  type IntelligenceNotAssessedFacet,
  type ReadinessThresholdView,
} from './intelligence-view';

export {
  appendClientRecord,
  CLIENT_RECORD_DRAFT_FIELDS,
  clientRecordDraftFromFormEntries,
  emptyClientRecordDraft,
  parseExternalRefsText,
  renderClientRecordFile,
  validateClientRecordDraft,
  type ClientRecordDraft,
  type ClientRecordDraftOutcome,
} from './client-record-draft';

export {
  answerFileNameFor,
  assertSafeClientIdForFileName,
  DISCOVERY_WORKSPACE_VARIABLE,
  draftFileNameFor,
  resolveDiscoveryWorkspace,
  sourceConfirmedFileNameFor,
  UnsafeClientIdError,
  type DiscoveryWorkspace,
} from './discovery-workspace';

export {
  parseSourceConfirmedAnswers,
  renderSourceConfirmedAnswers,
  SourceConfirmedAnswersError,
} from './source-confirmed-answers';

export {
  DRAFT_STORAGE_STATES,
  describeDraftStorage,
  recordPassageForQuestion,
  recordPassageInDraft,
  type DraftStorageState,
  type RecordPassageForQuestionOptions,
  type RecordPassageInDraftOptions,
  type SourceAcceptanceOutcome,
} from './source-acceptance';

export { describeSourcesCoverage } from './sources-coverage';

export {
  BOTH_INTAKE_CHANNELS_READ,
  presentSourceConfirmedChannel,
  SOURCE_CONFIRMED_LABEL,
  SOURCE_CONFIRMED_SEPARATION_NOTE,
  type SourceConfirmedChannelView,
  type SourceConfirmedPresence,
} from './source-confirmed-channel';

/**
 * ⚠️ Re-exported so `apps/studio` can name a passage and a document without
 * depending on `@age/assisted-intake` directly — the acceptance path stays the
 * one in this package.
 */
export type { SourceDocument, SourcePassage } from '@age/assisted-intake';

export {
  presentSystemStatus,
  type CaptureStoreState,
  type IdentityState,
  type StatusFacet,
  type SystemStatusInput,
} from './system-status';

export {
  ANSWER_FILE_PROVENANCE,
  buildStoredSnapshotView,
  STORED_SNAPSHOT_PROVENANCE,
  TWO_ANSWERS_NOTICE,
  type StoredSnapshotAbsentScoreView,
  type StoredSnapshotSectionView,
  type StoredSnapshotView,
} from './stored-snapshot-view';

/**
 * What each source system RELAYED — and, just as loudly, what silence from any
 * other system does not mean (ADR-0069 D5, D6).
 */
export {
  presentRelayedObservations,
  RELAY_ARRIVAL_NOTICE,
  RELAY_SILENCE_NOTICE,
  RELAY_UNMAPPED_NOTICE,
  type RelayedObservationsView,
  type RelayedObservationView,
  type RelayedSourceSystemView,
} from './relayed-observations-view';

/**
 * What AGE CONCLUDES, and — just as loudly — the four different silences it
 * must never flatten into a clean bill (ADR-0069 D1/D2/D7).
 */
export {
  DERIVATION_NOTICE,
  NO_OBSERVATION_RELAYED_EXPLANATION,
  NOTHING_CONCLUDED_NOTICE,
  PERSISTENCE_NOTICE,
  presentDerivedIntelligence,
  type DerivedConclusionView,
  type DerivedContributorView,
  type DerivedIntelligenceView,
  type UnconcludedView,
  type UnmodelledKindView,
  type UnobservedSubjectView,
  type UnrelatedObservationView,
} from './derived-intelligence-view';

/**
 * What AGE WOULD TELL A PEER, put on a screen (ADR-0069 deliverable 7).
 *
 * 🛑 Every string is the projection's own, byte-identical — the operator audits
 * the peer's answer, 🚫 never a console rendering of it. The one sentence this
 * view authors says the OPERATOR is the transport (ADR-0071 D1), so 🚫 nobody
 * reads the screen as evidence that peers are being served.
 */
export {
  HOW_THIS_REACHES_A_PEER_NOTICE,
  presentClientContextProjection,
  type ClientContextProjectionView,
  type ProjectedSubjectKindView,
} from './client-context-projection-view';

/**
 * What the operator CARRIES to a peer (ADR-0071 D1 — the operator is the
 * transport). 🛑 The document is the projection unchanged (D5); 🚫 the console's
 * own sentence never travels, and 🚫 nothing is sent by building it.
 */
export { buildClientContextHandover, type ClientContextHandover } from './client-context-handover';

/**
 * ⚠️ Re-exported so a Studio client component can name the shape it renders
 * WITHOUT importing the server module that opens the connection. 🚫 A type only
 * — no repository, no façade and no relay path travels with it.
 */
export type { StoredSourceObservation } from '@age/source-observation';
