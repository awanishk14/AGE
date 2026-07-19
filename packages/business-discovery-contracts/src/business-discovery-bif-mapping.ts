import type { BusinessDiscoveryProfile } from './business-discovery-profile';
import type { BifCompatibleBusinessContext } from './bif-compatible-context';

/**
 * mapBusinessDiscoveryToBifContext — pure, deterministic projection of a
 * `BusinessDiscoveryProfile` into a `BifCompatibleBusinessContext`.
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
