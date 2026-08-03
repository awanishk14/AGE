# Phase 5 — Gap Analysis

> Identification only. 🚫 **Nothing here is authorized to be implemented.** Each gap becomes an ADR in
> Phase 6 and a slice in Phase 7, and no slice starts before its ADR is Accepted.

---

## Summary

| ID       | Gap                                        | Blocks           | Severity       | Precondition                              |
| -------- | ------------------------------------------ | ---------------- | -------------- | ----------------------------------------- |
| **G-1**  | Snapshot **read** path                     | S1, S3, S5, S11  | 🔴 Critical    | ADR-0055 D7 — the operator's own D6 write |
| **G-2**  | Runtime caller over a real stored context  | S8               | 🔴 Critical    | G-1                                       |
| **G-3**  | Evidence ingestion                         | S6, S7           | 🟠 High        | ADR-0056 D3                               |
| **G-4**  | Contradiction detection over real evidence | S7               | 🟠 High        | G-3                                       |
| **G-5**  | Contradiction adjudication (a write)       | S7               | 🟡 Medium      | G-4 — 🚫 **never from the console**       |
| **G-6**  | SIE wiring                                 | S9               | 🟠 High        | G-2                                       |
| **G-7**  | Execution + approval                       | S10              | 🔴 Critical    | Was **reverted**                          |
| **G-8**  | Peer contract clients                      | S12              | 🟡 Medium      | Dissent 3 open                            |
| **G-9**  | Search                                     | —                | 🟢 Low         | Volume                                    |
| **G-10** | Notifications                              | —                | 🟢 Low         | 🚫 Conflicts with D6 c.5                  |
| **G-11** | Knowledge graph producer                   | Knowledge        | 🟡 Medium      | G-3                                       |
| **G-12** | Task queue                                 | —                | 🟢 Low         | 🚫 Conflicts with D6 c.5                  |
| **G-13** | Live organization onboarding               | S2               | 🟡 Medium      | ADR-0053 D3                               |
| **G-14** | **Entitlement function**                   | Any non-loopback | 🔴 **Ceiling** | Must precede, never retrofit              |
| **G-15** | Authentication                             | Any second user  | 🔴 **Ceiling** | G-14                                      |
| **G-16** | HTTP surface for the console               | All screens      | 🔴 Critical    | OX-INV-1                                  |
| **G-17** | Testable web rendering layer               | All screens      | 🟠 High        | `jsdom` absent                            |

---

## The critical path

**G-16 → G-1 → G-2 → G-6.** Everything else is a branch off it.

⚠️ **Amended 2026-08-03: G-14 is now on the critical path by owner decision** — the J→K→L track starts
**now, in parallel**, and Identity is one of the three named areas of primary effort under the
architecture freeze. 🚫 Loopback-only is what made deferring G-14 _survivable_, never what made it
_unnecessary_, and ⚠️ **no action-class rule discharges it**: a surface that never writes can still read the wrong
tenant's snapshots. ⚠️ **The 2026-08-03 clarification (ADR-0057 §0.7) made this SHARPER, not softer** —
now that Platform Administration and Knowledge Authoring are allowed, a mis-scoped call can **write**
under the wrong tenant too, so 🚫 the "lower blast radius" argument no longer applies.

⏸️ **Deferred by the freeze:** G-8 (peers) and G-11 (knowledge graph).
🛑 **G-13 and the console half of G-5 are NO LONGER MOOT** — they were moot only while the console
could not write, and ADR-0057 §0.7 reversed that. They are **live gaps again.**

---

## G-1 — Snapshot read path 🔴

The write path is complete and exercised. There is **no read path**: `CaptureConnection` exposes only
`{ orchestrator, close }`.

⚠️ **This is a governance defect, not a feature gap** (ADR-0055 §0.2 finding 1). ADR-0054 D7's own
success test says the operator "can then read back" the row — **no operator action can currently
satisfy it.** ADR-0055 is Accepted and authorizes the `inspect` slice.

🛑 **D7 is a precondition, not a nicety: the slice must not start until the operator has performed the
D6 write.** 🚫 **Do not seed a row.** A seeded row proves only that the reader reads what this
repository wrote — the exact self-confirming result the slice exists to avoid.

Constraints: read over a connection **structurally incapable of writing** (not a flag) · rows are
untrusted input, re-validated via `normalizeScoredBifSnapshotRecord` · renders the projection, never a
reconstructed BIF.

---

## G-2 — Runtime caller 🔴

Every capability test drives an **injected runtime**. The suite proves the **shape**, not the run.
Nothing feeds a capability from a real stored context.

ADR-0055 D8 authorizes exactly this — feed a capability from a real stored context, **even if the
honest result is zero signals** — and refuses categorically: a seventh capability, a new engine, a new
contracts package, mcp-ads/RankOps wiring, any API/Web/auth/multi-user/background surface, and any
change that improves a score or lifts a cap.

⚠️ **This is ADR-0053 dissent 2's ceiling.** Slice A was the fifth shape-only slice; another slice
that discards its output is not acceptable.

---

## G-3 — Evidence ingestion 🟠

`@age/evidence-contracts` defines the vocabulary. `@age/research-intelligence-engine` has sources,
extractors, normalizers and validators. **Nothing connects them to a business.** S6 has no data at all.

Constraints: 🚫 **no `EvidenceSourceClass`** and 🚫 **no `QUESTION`/`ENGAGEMENT` signal types** —
ADR-0056 D1/D2 rejected · honour **D3**, discovery vs performance never blended · if a classification
is ever wanted it belongs on the `Evidence` record set by the **fetching adapter**, and that cannot be
decided before an adapter exists · a producer needing a vocabulary the enum lacks **already has
`ExtractedSignal.type`, which is plain `string`**.

---

## G-4 / G-5 — Contradictions 🟠 / 🟡

`detect-contradictions.ts` exists; `EvidenceState.CONFLICTED` exists. Neither runs over real evidence,
and there is no adjudication path.

⚠️ **Adjudication is a write into an append-only world.** It cannot mutate a snapshot. Whether it is a
new snapshot, a separate record, or purely a rendering concern is an **open architectural question**
and a stop.

⚠️ **The detector's precision is unproven.** ADR-0056 §D2.1's supersession turned on exactly this: two
correct measurements of different things would have been reported as a contradiction. 🚫 Do not surface
a detector to the operator before it has been made to fail on a known non-contradiction.

---

## G-6 — Strategy engine wiring 🟠

SIE is present and unreachable. Analysis, opportunities, prioritization, recommendations, roadmaps,
scoring, simulation, validators — no caller anywhere.

⚠️ **Wiring an engine is not a UI slice.** It needs its own ADR, and it must not be smuggled in as
"S9 needs data".

---

## G-7 — Execution and approval 🔴

⚠️ **This was built and deliberately reverted.** PRs #41–#61, `@age/execution-contracts`, the approval
workflow, `@age/platform-context`. The six pending approvals in the demo are scenario data.

🚫 **S10 must not be built from Phase 3's specification.** Re-introducing execution is a major
architectural decision requiring its own ADR and an explicit account of why the revert is being undone
— not a screen.

---

## G-8 — Peer contract clients 🟡

No client exists for any peer. ⚠️ **Dissent 3 is deliberately open** — RankOps is unfinished, so
mcp-ads may be the right first integration; that is **not decided**. S12 must render zero peers
honestly first.

---

## G-9 / G-10 / G-12 — Search, notifications, task queue 🟢

🚫 **Notifications and a task queue conflict directly with ADR-0054 D6 condition 5** — no background
execution, scheduling or automation. Neither can be built while D6's relaxation is what permits capture
at all. Search is premature at single-operator volume.

---

## G-11 — Knowledge graph producer 🟡

BKG has nodes, edges, ontology, builders and queries, and no producer. A Knowledge screen today would
render an empty graph and imply AGE knows more than it does.

---

## G-13 — Live organization onboarding 🟡 — 🛑 **REOPENED 2026-08-03 (ADR-0057 §0.7)**

⚠️ Previously marked moot because the console could not write. **Create Organization and Create Client
are now Platform Administration, an ✅ allowed class**, so this gap is live and must be designed rather
than dismissed. 🛑 **Invite Members is NOT unblocked by it** — there is no identity to invite anyone
into, and 🚫 an invitation must never be treated as an access grant (ADR-0057 §0.7 note 1).

Records are hand-authored files. A console-driven flow is possible **only outside the repository**, and
🚫 records are never committed — not even redacted or masked. ⚠️ Visibility is **not** a control: the
repository flipped private and back in a day without anyone noticing, and history stays committed
either way.

---

## G-14 — Entitlement function 🔴 **the ceiling**

Scope is **asserted by the caller** and only checked for **self-consistency**. RLS proves a row agrees
with its own declared scope; **it never checks entitlement**.

> The moment an HTTP handler derives `clientId` from a request, every tenant sharing `age_app` reads
> every other tenant's snapshots — **a property the design already has, which single-user operation
> conceals.**

⚠️ An entitlement function must become the **only producer** of a `ClientContext` for persistence,
**before** any networked surface, **never retrofitted under one**.

**The console does not clear this ceiling — it stands underneath it via OX-INV-1.** A loopback-bound
listener under an ambient trust model is the CLI's trust model with a different input device. 🚫 That
equivalence is destroyed by a reverse proxy, a tunnel, a container port publish, or a `0.0.0.0` bind,
and OX-INV-1 can only refuse the last of those.

---

## G-15 — Authentication 🔴 **the ceiling**

ADR-0053 dissent 1: _the first slice that lets a second person act, or that exposes AGE beyond the
operator's terminal, must build authentication first._ The brief defers this, and the deferral is only
coherent while the console is loopback-only and single-operator. **G-14 precedes G-15**; authentication
without entitlement authenticates a caller who can still assert any scope.

---

## G-16 — HTTP surface 🔴

`apps/api` has two routed endpoints. The console needs read endpoints, and they must carry OX-INV-1,
the refusal-rendering rule, and 🚫 no stack, no driver message, no connection string.

---

## G-17 — Testable rendering layer 🟠

`apps/web` unit tests are **not functional** — vitest wants `jsdom`, which is not installed; only
Playwright e2e exists. ⚠️ Any screen logic placed in a component is untestable. It must live in a
package, as ADR-0048 already established for the readiness surface. 🚫 Do not put logic in a component
because that is where the data is.
