# ADR-0039 — Demo Metadata Source for Path B Mapping

- Status: Proposed
- Date: 2026-07-26
- Supersedes: none
- Related: ADR-0025 (Discovery → BIF prerequisites), ADR-0030 (`ClientContext` authoritative for
  scope), ADR-0037 (`produceScoredBifContext`), ADR-0038 (two mapping paths; D6 forbids invented demo
  metadata)

> This is a decision request. It must not be self-accepted and nothing in it may be implemented
> before it is Accepted.

## Context

ADR-0038 is Accepted. It named `produceScoredBifContext` (**Path B**) the single sanctioned
Discovery → BIF mapping and `mapBusinessDiscoveryToBifContext` (**Path A**) a temporary legacy demo
bridge. PR #131 pinned Path A's only non-test caller to
`packages/demo-runtime/src/business-discovery.ts` and made that claim enforceable.

ADR-0038 **D6** then blocked the demo migration outright: Path B requires `organizationId`,
`constructedAt` and `changedBy`, and the demo had no legitimate source for them. D6 rejected
hardcoded mapper constants, fixture-only fake metadata, and any optional-input variant of Path B.

What D6 did **not** rule out — and what this ADR proposes — is the demo **owning and declaring its
own scenario metadata explicitly**. The distinction is not cosmetic. A constant buried in the mapper
is a lie told on every caller's behalf; a named scenario object at the demo boundary is the demo
stating, in the open, which scenario it is running.

### What the demo does today

`runBusinessDiscoveryIntake()` takes no arguments. It loads `SAMPLE_BUSINESS_DISCOVERY_PROFILE`,
validates it twice, calls Path A, and returns counters including `mappedSectionKeys` — currently
**8 keys**, derived from a curated per-key predicate over the local `BifCompatibleBusinessContext`.

## Decisions proposed

**D1. Demo-runtime owns an explicit demo scenario metadata source.** A small, named, frozen object
declared in `@age/demo-runtime`, alongside the pipeline that consumes it. Not in
`@age/business-discovery-contracts`, not in `@age/bif`, not in a fixture that pretends to be data.

**D2. It supplies exactly three values** — `organizationId`, `constructedAt`, `changedBy` — because
those are exactly what Path B requires. It does not grow a fourth field speculatively.

**D3. It is passed explicitly into the demo pipeline.** `runBusinessDiscoveryIntake` takes the
metadata as a parameter rather than reaching for a module-level constant, so the value is visible at
the call site and a test can pass a different one. Whether the demo entry point supplies a default is
an implementation detail of the slice; the parameter is not.

**D4. The values are labelled demo scenario metadata, not production tenant identity.** The naming
and doc comments must say so at the declaration, so nobody later mistakes the demo's
`organizationId` for a real tenant. It is scenario framing: _"this is the fictional organization the
sample profile belongs to."_

**D5. Path B remains canonical and unchanged.** No optional inputs, no demo-only overload, no third
path. If Path B cannot be called as it stands, the slice stops rather than bending the contract.

**D6. `mappedSectionKeys` may change, and the honest result is kept.** Path A reports 8 local
grouping keys; Path B reports canonical BIF sections with omissions modelled first-class — on the
sample profile, **7 present and 5 omitted**. The demo output will change. That change is a more
truthful report, not a regression, and **no value may be invented to keep the old number**.

**D7. Path A retirement is authorized only after tests prove no live caller remains.** It is a
separate PR, gated on the migration actually landing.

## The eleven questions

1. **Where does demo `organizationId` come from?** The demo scenario metadata object in
   demo-runtime. A fictional, clearly-labelled scenario organization id — not a tenant.
2. **Where does demo `constructedAt` come from?** The same object, as a fixed timestamp. **Not
   `new Date()`.** The demo is deterministic and the mapper deliberately reads no clock; a live clock
   would break both. A fixed timestamp is not a fake reading — it is a declared scenario property,
   the same way the sample profile's `capturedAt` already is.
3. **Where does demo `changedBy` come from?** The same object. A named demo actor, labelled as such.
4. **Where should the metadata source live?** `packages/demo-runtime/src/`, next to the pipeline.
   At the demo-runtime boundary, per the approved direction.
5. **Is this production tenant metadata?** **No.** It is scenario metadata for a fictional sample
   business, and must be labelled so at the declaration.
6. **How does this relate to `ClientContext`?** It does not replace it and does not wire it.
   `ClientContext` stays authoritative for real `clientId`/`organizationId` scoping (ADR-0030), and
   scope still never rides a payload. The demo produces no snapshot, performs no scoped read or
   write, and needs no `ClientContext`. Introducing one here would invent tenancy the demo does not
   have — the same error in a different costume.
7. **Does this authorize workspace implementation?** **No.**
8. **Does this authorize API/Web?** **No.**
9. **Does this authorize `Draft → Active`?** **No.** Path B produces a Draft BIF and it stays Draft.
10. **Does this authorize deleting Path A?** **Not directly.** It authorizes retirement _after_ the
    migration lands and tests prove no live non-test caller remains — its own PR.
11. **What is the first implementation slice after acceptance?** One PR: add the metadata object,
    thread it explicitly into `runBusinessDiscoveryIntake`, switch that function to
    `produceScoredBifContext`, update the summary and its tests to report what Path B honestly
    returns, and update the PR #131 guard now that demo-runtime is no longer a Path A caller.

## Options considered

**Option 1 — leave the demo on Path A indefinitely.** Rejected: ADR-0038 already named Path A
temporary, and permanent temporariness is just an unmaintained second path.

**Option 2 — hardcode the three values inside the mapper or as Path B defaults.** Rejected by
ADR-0038 D6, and rightly: it would fabricate provenance for every caller, not just the demo.

**Option 3 (recommended) — demo-owned, explicitly-passed scenario metadata.** The demo declares what
scenario it is running, in the open, at its own boundary. Nothing downstream changes; nothing is
invented on anyone else's behalf.

## Consequences

- The demo's printed output changes where Path B honestly reports differently — expected, and PR C
  must state the before/after explicitly rather than quietly re-pinning assertions.
- The demo gains a real dependency on the scored chain, giving Path B its **first runtime caller**.
- Path A loses its only caller, which is what unlocks retirement.
- Demo determinism is preserved: fixed profile, fixed metadata, no clock, no randomness.

## Non-goals

No API/Web exposure. No workspace. No `Draft → Active`. No `ClientContext` runtime wiring. No
persistence, schema, migration or RLS change. No execution behaviour. No third mapping path. No
change to `produceScoredBifContext`, the mapper, the scorer or the projector.

## Stop conditions for the implementation slice

Stop and ask rather than proceed if: the metadata source would require production workspace
semantics; Path B cannot be called without changing its contract; the smoke output change turns out
broad or unclear; the migration would need API/Web, `ClientContext` wiring or persistence; or Path B
cannot represent the demo's output honestly.

## Open questions

1. Does the intake summary keep reporting section _keys_, or switch to reporting Path B's present
   sections plus its omitted ones? The second is more informative and is the honest shape of the new
   output. To be settled in the slice, on evidence, and stated in the PR.
2. Should the scored context's root confidence/completeness (17 / 12 on the sample) be printed?
   Informative, but it is new output rather than migrated output — defer unless it falls out
   naturally.
