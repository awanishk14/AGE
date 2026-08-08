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
  UnsafeClientIdError,
  type DiscoveryWorkspace,
} from './discovery-workspace';

export {
  presentSystemStatus,
  type CaptureStoreState,
  type IdentityState,
  type StatusFacet,
  type SystemStatusInput,
} from './system-status';
