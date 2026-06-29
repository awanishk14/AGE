/**
 * Capability — the six business capabilities plus the platform-layer Strategy.
 *
 * Strategy is realized by the SIE (not a capabilities/ package).
 * The other six map 1:1 to packages/capabilities/*.
 *
 * These answer "why are we doing this work?" (CAPABILITY_ARCHITECTURE §2).
 * They are separate from ExecutionDomain, which answers "where is it executed?"
 */
export enum Capability {
  MarketDiscovery = 'MarketDiscovery',
  Intelligence = 'Intelligence',
  Growth = 'Growth',
  Authority = 'Authority',
  Operations = 'Operations',
  Revenue = 'Revenue',
  Strategy = 'Strategy',
}
