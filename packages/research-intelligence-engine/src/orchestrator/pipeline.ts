/** The ordered stages of the RIE orchestration flow. */
export enum PipelineStage {
  Source = 'SOURCE',
  Adapter = 'ADAPTER',
  Normalizer = 'NORMALIZER',
  Extractor = 'EXTRACTOR',
  SignalEngine = 'SIGNAL_ENGINE',
  Evidence = 'EVIDENCE',
  Mapping = 'MAPPING',
  Proposal = 'PROPOSAL',
}

/**
 * ORCHESTRATION_FLOW — the canonical order of stages:
 * Source → Adapter → Normalizer → Extractor → Signal Engine → Evidence → Mapping → BIF Proposal.
 * Definition only; no execution.
 */
export const ORCHESTRATION_FLOW: readonly PipelineStage[] = [
  PipelineStage.Source,
  PipelineStage.Adapter,
  PipelineStage.Normalizer,
  PipelineStage.Extractor,
  PipelineStage.SignalEngine,
  PipelineStage.Evidence,
  PipelineStage.Mapping,
  PipelineStage.Proposal,
];
