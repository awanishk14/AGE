# ADR 0007: Separate Capability from ExecutionDomain (two axes)

- Status: Accepted
- Date: 2026-06-28

## Context

The capability shift (ADR-0006) raised the question of how to reconcile capabilities with the
channel-shaped `OpportunityCategory` enum in the SIE. Collapsing "why we act" and "where we act"
into a single enum would conflate business intent with execution surface and make both impossible
to evolve independently.

## Decision

Model two **separate** axes — never a single enum:

- **`Capability`** answers _"why are we doing this?"_ —
  `MarketDiscovery`, `Intelligence`, `Strategy`, `Growth`, `Authority`, `Operations`, `Revenue`.
- **`ExecutionDomain`** answers _"where will this be executed?"_ —
  `SEO`, `AEO`, `GEO`, `LocalSEO`, `GoogleAds`, `MetaAds`, `LinkedInAds`, `CRO`, `Content`, `Email`,
  `PR`, `CRM`, `Reporting`, `Automation`, `SSH`, `Publishing`.

`StrategyOpportunity` will carry both: `capability` and `executionDomains[]`. The existing
`OpportunityCategory` is **not** replaced by this change; reconciling/retiring it is deferred to
implementation.

## Consequences

- A capability can orchestrate many execution domains; an execution domain can serve many capabilities.
- The two enums evolve independently (new channels don't change capabilities and vice-versa).
- Opportunities become explainable along both intent and execution surface.
