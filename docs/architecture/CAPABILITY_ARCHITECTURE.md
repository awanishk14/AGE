# AGE — Capability Architecture (Blueprint)

> Status: **Design blueprint** (post-Task-008, pre-Task-009). No code. This document is the
> stable contract for every engine built from Task 009 onward — the blueprint for the next 50+ tasks.

## 1. The strategic correction

Everything through Task 008 is a **platform engine**:

```
BKG  → semantic model        BIF  → business truth
RIE  → external evidence      SIE  → structured decisions
```

The temptation now is to build **channel engines** (SEO Engine, Ads Engine, Content Engine). That
is how every marketing platform (SEMrush, etc.) is built. **AGE is built differently.**

AGE is the **operating system for a growth agency**. Its architecture must model **how agencies
create business outcomes**, not how marketing software categorizes features. Therefore everything
after SIE is organized around **business capabilities**, not marketing channels.

> A channel (SEO, Google Ads, a blog) is an **execution path _within_ a capability** — never a
> capability itself.

## 2. Layered position

```
        ┌──────────────────────────────────────────────────────────┐
        │  BKG (semantic)            BIF (truth)                     │  Knowledge / Memory
        └──────────────────────────────────────────────────────────┘
                        │                       ▲ (proposals only, never writes)
                        ▼                       │
                       RIE  ── evidence ──▶  Intelligence Capability  (truth quality)
                                                     │ curated, scored, de-conflicted evidence
                                                     ▼
                                                    SIE  ── DecisionPackage ──┐
                                                                              ▼
        ┌──────────────────── Capability Layer (Phase 2–4) ──────────────────────┐
        │  Discovery   Growth   Authority   Operations   Revenue                   │
        │  (each consumes the DecisionPackage + BIF/BKG/curated evidence,          │
        │   produces capability-specific PLANS — still decision objects)           │
        └──────────────────────────────────────────────────────────────────────────┘
                                                     │ capability plans
                                                     ▼
        ┌──────────────────── Execution Layer (Phase 5) ─────────────────────────┐
        │  SEO exec · Ads exec · Content exec · Reporting exec · Proposal exec ... │
        └──────────────────────────────────────────────────────────────────────────┘
```

**Intelligence Capability is special**: it sits _between RIE and SIE_ and governs truth quality.
The other five capabilities sit _after SIE_ and consume its `DecisionPackage`.

## 3. The Capability Contract (applies to every capability)

Every capability is a package that:

- **Consumes (read-only, by reference):** the SIE `DecisionPackage`, BIF (`BIFFieldRef`), BKG nodes,
  and curated evidence. It **never writes** to BIF / RIE / BKG / SIE.
- **Produces:** capability-specific **plan / opportunity objects** — still _decision objects_, not
  side effects. (e.g. Discovery produces SEO/AEO/GEO opportunities; Growth produces ad plans.)
- **Orchestrates multiple channels** as execution paths beneath one business outcome.
- **Never executes.** Execution is Phase 5; execution engines consume capability outputs.

A shared `CapabilityOutput` base (to be defined in Task 009) gives every capability a common
envelope: `capability`, `organizationId`, `inputs` (referenced ids), `items[]`, `generatedAt`,
`confidenceScore`. Channels appear as a typed field on each item, not as separate packages.

## 4. The capabilities

### Intelligence Capability (between RIE and SIE) — _truth quality_

**Mission:** keep Strategy focused on decisions while it focuses on the quality of truth.
**Responsibilities:** evidence quality scoring · source reliability · confidence propagation ·
contradiction resolution · knowledge freshness · evidence aging · research deduplication.
**Consumes:** RIE evidence, BIF, BKG. **Produces:** curated, scored, de-conflicted evidence +
resolved `FieldConflict`s that feed SIE.

### Discovery Capability — _find opportunities_

**Produces:** SEO · AEO · GEO · Local-SEO · competitor · keyword opportunities.
SEO is one execution path here, not the capability.

### Growth Capability — _paid media, CRO, funnels_

**Produces:** Google Ads · Meta Ads · LinkedIn Ads plans · CRO improvements · funnel optimization ·
landing-page strategy.

### Authority Capability — _content, PR, reputation_

**Produces:** content strategy · thought leadership · PR strategy · backlink strategy · review
strategy · video strategy · podcast strategy.

### Operations Capability — _delivery & execution management_

**Produces:** project plans · client reporting · team assignments · SOP execution · QA workflows ·
delivery tracking.

### Revenue Capability — _pipeline & account growth_

**Produces:** proposal generation · lead qualification · CRM recommendations · pipeline health ·
upsell opportunities · account growth plans.

## 5. Revised roadmap

| Phase | Name                     | Contents                                             | Status                          |
| ----- | ------------------------ | ---------------------------------------------------- | ------------------------------- |
| 1     | **Cognitive Core**       | Domain · BKG · BIF · RIE · SIE                       | ✅ Complete (`foundation-v0.1`) |
| 2     | **Intelligence**         | Intelligence Capability · Discovery Capability       | Next                            |
| 3     | **Growth**               | Growth Capability · Authority Capability             | —                               |
| 4     | **Agency Operations**    | Operations Capability · Revenue Capability           | —                               |
| 5     | **Autonomous Execution** | SEO · Ads · Content · Reporting · Proposal execution | —                               |

## 6. Relationship to existing engines

- **SIE `OpportunityCategory`** is still channel-shaped (SEO/AEO/GEO/…). Under this model those
  become **execution-path tags within a capability**, not top-level categories. A new `Capability`
  enum (Intelligence/Discovery/Growth/Authority/Operations/Revenue) becomes the top-level axis.
- **SIE may re-source its evidence** from the Intelligence Capability (curated) instead of raw RIE.
  This is the one upstream rewire implied by the new layer.
- **No package built so far needs to be deleted** — capabilities sit _on top of_ SIE and _beside_
  the RIE→SIE path (Intelligence). The Cognitive Core is stable.

## 7. Proposed package layout (to confirm in Task 009)

```
packages/capabilities/
  intelligence/      @age/capability-intelligence
  discovery/         @age/capability-discovery
  growth/            @age/capability-growth
  authority/         @age/capability-authority
  operations/        @age/capability-operations
  revenue/           @age/capability-revenue
packages/capability-kit/   @age/capability-kit  (shared CapabilityOutput base + Capability enum)
```

## 8. Open design decisions (for sign-off before Task 009)

1. **Capability enum vs `OpportunityCategory`** — replace, wrap, or keep alongside? (Recommendation:
   add `Capability` as the top-level axis; demote channels to execution-path tags.)
2. **SIE input rewire** — does SIE consume curated evidence from the Intelligence Capability instead
   of raw RIE? (Recommendation: yes, in Phase 2.)
3. **Shared `CapabilityOutput` contract** — one envelope + per-capability item types, in a
   `@age/capability-kit` package? (Recommendation: yes.)
4. **Package layout** — `packages/capabilities/*` (recommended) vs `packages/*-capability`.
5. **Execution boundary** — confirm Phase 5 execution engines are the _only_ components with side
   effects; capabilities remain pure planners.

See ADR-0006 for the decision record.
