# @age/research-intelligence-engine (RIE)

A **sensing layer**: it reconstructs reality from evidence. It converts external data into
`Evidence`, `ExtractedSignal`s, `IntentCluster`s, **BIF mapping proposals** and
`EvidenceConflict`s.

**Hard rules:** no scraping, no inference engine, no business logic, and the RIE **never modifies
BIF** — it only proposes. Contracts, types, enums and Zod schemas only.

```
External Data → RIE → BIF → AGE Engines

src/
  types/         enums (EvidenceSource, SignalType, Polarity, BIFMappingAction, ConflictSeverity), RawData
  sources/       MVP source list (adapters implemented later)
  normalizers/   NormalizedDocument
  signals/       ExtractedSignal
  evidence/      Evidence (core output) + EvidenceEntityLink
  intent/        IntentCluster
  extractors/    placeholder extractors (PainPoint, Intent, Competitor, Pricing, FeatureRequest)
  mapping/       BIFMapping (proposal) + EvidenceConflict
  interfaces/    SourceAdapter, Normalizer, Extractor, SignalEngine, MappingEngine, ResearchPipeline
  orchestrator/  PipelineStage + ORCHESTRATION_FLOW
  validators/    Zod schemas
  index.ts
```
