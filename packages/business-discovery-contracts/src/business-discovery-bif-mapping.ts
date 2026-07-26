import type { BusinessDiscoveryProfile } from './business-discovery-profile';
import type { BifCompatibleBusinessContext } from './bif-compatible-context';

/**
 * mapBusinessDiscoveryToBifContext — pure, deterministic projection of a
 * `BusinessDiscoveryProfile` into a `BifCompatibleBusinessContext`.
 *
 * LEGACY — TEMPORARY DEMO BRIDGE (ADR-0038, Accepted). This is **Path A**, and
 * it is not the sanctioned Discovery → BIF mapping. **New code must use
 * `produceScoredBifContext` (Path B)**, which produces a real Draft BIF, scores
 * it, and projects the `ScoredBifContext` that capabilities consume and that
 * snapshot persistence stores.
 *
 * Path A survives for exactly one reason: `@age/demo-runtime` still calls it,
 * and moving the demo to Path B would require `organizationId`, `constructedAt`
 * and `changedBy`, which the demo has no legitimate source for. ADR-0038 D6
 * forbids inventing them — a hardcoded constant is not a weaker source than a
 * real one, it is a false one. So the demo migration is blocked, not merely
 * deferred, until that source is decided in its own ADR or slice.
 *
 * It is not marked `@deprecated`: the replacement is unavailable to its only
 * caller, and a deprecation nobody can act on is noise. `path-a-legacy-bridge.spec.ts`
 * pins the caller list to that one file instead, so "temporary" stays checkable.
 *
 * This is a direct structural transformation only: it re-groups captured intake
 * data into BIF-aligned buckets and carries values through verbatim. It performs
 * NO inference, NO scoring, NO strategy recommendation, NO execution planning,
 * NO AI/LLM call, NO URL fetching and NO external I/O. The input profile is
 * never mutated — every projected collection is a fresh array. Output depends
 * only on the input (no wall-clock read), so identical input yields identical
 * output.
 */
export function mapBusinessDiscoveryToBifContext(
  profile: BusinessDiscoveryProfile,
): BifCompatibleBusinessContext {
  return {
    sourceProfileId: profile.id,
    capturedAt: profile.capturedAt,
    organizationIdentity: {
      name: profile.businessName,
      ...(profile.industry !== undefined ? { industry: profile.industry } : {}),
      ...(profile.businessModel !== undefined ? { businessModel: profile.businessModel } : {}),
      ...(profile.brandPositioning !== undefined
        ? { brandPositioning: profile.brandPositioning }
        : {}),
    },
    customerSegments: [...profile.segments],
    offerings: [...profile.offerings],
    marketCompetition: {
      geographies: [...profile.geographies],
      competitors: [...profile.competitors],
    },
    marketingChannels: [...profile.marketingChannels],
    goals: [...profile.goals],
    constraints: [...profile.constraints],
    assets: [...profile.assets],
    evidenceSources: [...profile.evidenceSources],
    assumptions: [...profile.assumptions],
    gaps: [...profile.gaps],
  };
}
