import type { BIFSectionDefinition } from '@age/bif';

import type { BifConfidenceScoringMetadata } from './bif-confidence-scoring';
import { scoreBusinessIntelligenceFramework } from './bif-confidence-scoring';
import type {
  BusinessDiscoveryBifMetadata,
  BusinessDiscoveryToBifOptions,
} from './business-discovery-to-bif';
import { mapBusinessDiscoveryToBifDraft } from './business-discovery-to-bif';
import type { BusinessDiscoveryProfile } from './business-discovery-profile';
import type { ScoredBifContext } from './scored-bif-context';
import { projectScoredBifContext } from './scored-bif-context';

/**
 * The produce side of the scored BIF pipeline, written once (ADR-0037 D1).
 *
 * Discovery profile → canonical Draft BIF → confidence scores → the neutral
 * `ScoredBifContext` projection. Three pure functions that were, until now,
 * only ever chained by hand: eleven files called them and every one was a
 * test, nine of them re-deriving the same three lines with their own option
 * values. That is nine chances for a test to prove something about a pipeline
 * nobody assembles that way.
 *
 * IT ADDS NO STEP AND REPLACES NOTHING. All three functions stay exported and
 * independently callable; this only fixes the order and the wiring between
 * them — in particular that the scorer's metadata is threaded INTO the
 * projector (D5), which is the detail most easily lost when the chain is
 * copied. Omit it and the projector recomputes omissions structurally, giving
 * a second answer to a question the scorer already answered.
 *
 * IT IS PURE. No clock, no id generation, no randomness, no I/O (D3). Every
 * value the mapper needs is caller-supplied and passes straight through (D4) —
 * `constructedAt` above all, because the mapper deliberately reads no clock and
 * a chain that helpfully supplied `new Date()` would destroy that property on
 * its behalf.
 *
 * IT DOES NOT KNOW PERSISTENCE EXISTS (D7). No snapshot, no capture, no
 * `snapshotId`, no `capturedAt`. The produce side and the consume side meet in
 * a caller, not in either of them.
 */

/** What a caller supplies. Every mapper input, unchanged, plus the two optional definition sets. */
export interface ProduceScoredBifContextOptions extends BusinessDiscoveryToBifOptions {
  /**
   * Canonical section definitions for scoring and for projection. Defaults to
   * BIF's own `BIF_SECTIONS` inside each step — passed through only so a caller
   * with a narrower canonical set scores and projects against the same one.
   *
   * Deliberately a single option rather than two: two knobs would let a caller
   * score against one framework and project against another, and the mismatch
   * would surface as a quietly wrong omission list.
   */
  readonly sectionDefinitions?: readonly BIFSectionDefinition[];
}

/**
 * The projection, plus the metadata each step produced (D6).
 *
 * Returning only the context would discard what the mapper reported — unmapped
 * fields, per-field provenance, both completeness scores — and push any caller
 * who wants it straight back to re-deriving the chain by hand, which is the
 * thing this function exists to stop.
 */
export interface ProduceScoredBifContextResult {
  /** The neutral read-only projection (ADR-0026 D1). */
  readonly context: ScoredBifContext;
  /** What the mapper reported: population, provenance, unmapped fields. */
  readonly mappingMetadata: BusinessDiscoveryBifMetadata;
  /** What the scorer reported: omitted sections, warnings, reasons, scoringVersion. */
  readonly scoringMetadata: BifConfidenceScoringMetadata;
}

/**
 * Produces a `ScoredBifContext` from a business discovery profile.
 *
 * Invalid input still fails at the mapper's own guard — this adds no validation
 * of its own and swallows nothing.
 */
export function produceScoredBifContext(
  profile: BusinessDiscoveryProfile,
  options: ProduceScoredBifContextOptions,
): ProduceScoredBifContextResult {
  const { sectionDefinitions, ...mapperOptions } = options;

  const { bif: draft, metadata: mappingMetadata } = mapBusinessDiscoveryToBifDraft(
    profile,
    mapperOptions,
  );

  const { bif: scored, metadata: scoringMetadata } = scoreBusinessIntelligenceFramework(
    draft,
    sectionDefinitions === undefined ? {} : { sectionDefinitions },
  );

  const context = projectScoredBifContext(scored, {
    // Threaded, never recomputed (D5).
    scoringMetadata,
    ...(sectionDefinitions === undefined ? {} : { sectionDefinitions }),
  });

  return { context, mappingMetadata, scoringMetadata };
}
