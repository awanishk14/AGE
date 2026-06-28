# ADR 0006: Organize post-SIE engines around business capabilities, not channels

- Status: Accepted (with modifications — see ADR-0007, ADR-0008)
- Date: 2026-06-28

## Context

The Cognitive Core (Domain, BKG, BIF, RIE, SIE) is complete (`foundation-v0.1`). The natural next
step in most marketing platforms is channel engines: an SEO Engine, an Ads Engine, a Content
Engine. AGE's purpose is different: it is the **operating system for a growth agency**, so its
architecture must model **how agencies produce business outcomes**, not how marketing software
categorizes features.

## Decision

From Task 009 onward, everything above the SIE is organized around **business capabilities**, not
marketing channels:

- **Intelligence** (truth quality — sits between RIE and SIE)
- **Discovery**, **Growth**, **Authority**, **Operations**, **Revenue** (sit after SIE)

A marketing channel (SEO, Google Ads, a blog) is an **execution path within a capability**, never a
capability itself. Each capability consumes the SIE `DecisionPackage` (and BIF/BKG/curated
evidence) read-only, produces capability-specific plan objects, and **never executes** — execution
is a separate Phase 5 layer.

See `docs/architecture/CAPABILITY_ARCHITECTURE.md` for the full blueprint.

## Consequences

- New top-level axis `Capability`; SIE's channel-shaped `OpportunityCategory` is demoted to an
  execution-path tag (exact reconciliation tracked as an open decision).
- A new **Intelligence Capability** is introduced between RIE and SIE; SIE may re-source its
  evidence from it (curated) rather than raw RIE.
- Capabilities are pure planners; only Phase 5 execution engines have side effects.
- The Cognitive Core is unaffected — capabilities sit on top of it. No existing package is removed.
- This blueprint governs the next ~50 tasks and eases the internal-platform → SaaS transition.
