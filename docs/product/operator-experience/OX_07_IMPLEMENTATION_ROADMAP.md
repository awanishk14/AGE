# Phase 7 — Implementation Roadmap

> Dependency-aware, small vertical slices, each a usable improvement. No big bang.
> **🚫 Nothing here is authorized.** Every slice names the ADR that must be Accepted first.

---

## The rule this roadmap is built around

⚠️ **ADR-0053 dissent 2's ceiling, which is stricter than ADR-0052's:** slice A was the **fifth**
shape-only slice, and **the next slice must make an actual client's answers produce an actual stored
result.** Another slice that discards its output is not acceptable.

Every slice below therefore ends in something an operator can **see about their own business**. A
slice whose only artifact is a passing test does not qualify.

---

## Slice 0 — 🛑 The operator's own D6/D7 onboarding run

**Not code. Not the architect's.** Everything downstream of G-1 is blocked on it.

The path shipped; a real business has not passed through it. Every test drives an **injected
runtime** — the suite proves the shape, not the run. Discharged only once the operator has written a
row and read it back.

🚫 **Do not seed a row to unblock development.**

---

## Wave 1 — The console exists and tells the truth about itself

_Blocked on: ADR-0057, then B and C._

| Slice   | Delivers                                                                                                                       | Screens            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| **1.1** | Loopback-bound listener; a non-loopback bind is a **startup refusal**; a guard **mutation-proven** against a `0.0.0.0` bind    | —                  |
| **1.2** | Diagnostics: bind address, database **host only**, questionnaire version, refusal log                                          | S13                |
| **1.3** | Businesses, read from the operator's record file, refusing rather than degrading                                               | S2                 |
| **1.4** | Discovery: questionnaire rendered, answers loaded, **omission at least as prominent as answering**, refusals rendered verbatim | S4 (read/validate) |

**Usable after Wave 1:** the operator can see their businesses and validate an answer file without a
text editor — with zero database dependency.

⚠️ 1.1's guard is only evidence once it has been **made to fail**: bind non-loopback, confirm the
refusal names it, restore.
⚠️ 1.4 renders the domain's refusal text. 🚫 It must never render a caught `error.message` — that is
precisely how the three JSON-parse leaks reached stderr.

---

## Wave 2 — The row nobody reads becomes readable

_Blocked on: **Slice 0**, ADR-0055 D7, and ADR A._

| Slice   | Delivers                                                                                    | Screens |
| ------- | ------------------------------------------------------------------------------------------- | ------- |
| **2.1** | Read connection **structurally incapable of writing**; re-validates rows as untrusted input | —       |
| **2.2** | Snapshot list for a business, in capture order                                              | S11     |
| **2.3** | One snapshot's projection: 12 sections, **omissions as omissions**                          | S5      |
| **2.4** | Overview: the four scores, **kept apart**                                                   | S3      |

**Usable after Wave 2:** the operator can read back what AGE concluded about their business — the
first time that has ever been possible.

🚫 No edit, no delete, no restore, no "set current" anywhere in this wave.
⚠️ 2.3 renders a **projection** and labels it as one. There is no context→BIF direction, and
reconstructing a BIF would mean inventing version history and audit actors.

---

## Wave 3 — Capture from the console

_Blocked on: Wave 2 + **owner decision 1** (does the console capture at all?)._

| Slice   | Delivers                                                                                                          |
| ------- | ----------------------------------------------------------------------------------------------------------------- |
| **3.1** | Answer file written back to the operator's own file, outside the repo, via the **one** path-policy implementation |
| **3.2** | Dry run — produce and score without connecting to anything                                                        |
| **3.3** | Confirmed capture under all five ADR-0054 D6 conditions                                                           |

🚫 No capture-on-save. 🚫 No autosave-then-capture. 🚫 Nothing scheduled, ever.
⚠️ If the owner answers "read-only" to decision 1, **this entire wave is deleted** — and OX-INV-1 gets
materially easier to hold.

---

## Wave 4 — Intelligence over a real context

_Blocked on: Wave 2, ADR-0055 D8._

| Slice   | Delivers                                                                                             | Screens |
| ------- | ---------------------------------------------------------------------------------------------------- | ------- |
| **4.1** | One capability fed from a **real stored context** — ⚠️ **even if the honest result is zero signals** | S8      |
| **4.2** | The remaining five                                                                                   | S8      |
| **4.3** | Readiness for the three that expose it; 🚫 **nothing invented for the other three**                  | S8      |

⚠️ D8 refuses categorically: a seventh capability, a new engine, a new contracts package,
mcp-ads/RankOps wiring, any API/Web/auth/multi-user/background surface, and **any change that improves
a score or lifts a cap**.
⚠️ **A low score for the first real client is a correct result.** 🚫 Do not help it by touching a cap —
ADR-0051's 35 cap was lifted by making the evidence real.

---

## Wave 5 — Evidence and contradictions

_Blocked on: ADRs D, E, F._

| Slice   | Delivers                                                                                       | Screens |
| ------- | ---------------------------------------------------------------------------------------------- | ------- |
| **5.1** | The first ingestion adapter                                                                    | S6      |
| **5.2** | Evidence rendered with the **unsupported-field list** — the most valuable thing on the screen  | S6      |
| **5.3** | Contradictions, **only after the detector has been made to fail** on a known non-contradiction | S7      |
| **5.4** | Adjudication — 🛑 only if ADR F solves recording a judgement in an append-only world           | S7      |

🚫 No source-class facet. 🚫 No `QUESTION`/`ENGAGEMENT`. ⚠️ Discovery and performance evidence never
blended into one confidence figure (ADR-0056 D3).

---

## Wave 6 — Strategy

_Blocked on: Wave 4, ADR G._ Wire SIE (**its own ADR, not a UI slice**); render proposals with their
basis. ⚠️ A proposal that cannot state its basis is rendered as unattributed, or not at all.

---

## Wave 7 — Peer products

_Blocked on: ADR H, and **owner decision 2** — which peer is first. Dissent 3 is open._
7.1 renders **zero peers honestly**. Only then 7.2 connects one.

---

## The parallel track — and it should start first

```
J (entitlement) ── K (authentication) ── L (execution re-introduction)
```

⚠️ **This does not depend on the console and should not queue behind it.** ADR-0055 D9 records the
entitlement function as a ceiling, and it must become the only producer of a `ClientContext` for
persistence **before** any networked surface — **never retrofitted under one.**

The console standing under that ceiling via OX-INV-1 is a **containment**, not a resolution. Each
wave makes AGE more useful, and each increment of usefulness increases the pressure to expose it to
one more person. 🛑 **The right time to start J is before that pressure exists, which is now.**

---

## Dependency graph

```
Slice 0 (operator's run) ─────────────┐
                                       ▼
ADR-0057 ── B,C ── Wave 1 ── ADR A ── Wave 2 ──┬── Wave 3 (owner decision 1)
                                                ├── Wave 4 ── ADR G ── Wave 6
                                                └── ADR D ── Wave 5
ADR H ───────────────────────────────────────────── Wave 7 (owner decision 2)

ADR J ── ADR K ── ADR L        ← independent; start now
```

---

## What "done" means for this program

The operator can answer all eight questions from Bible §1 about a **real** business, on screen,
without reading code — and every answer carries its provenance, its confidence, and an honest account
of what AGE does not know.

⚠️ **Waves 1–4 achieve six of the eight.** Contradictions and peer products need Waves 5 and 7. Nothing
in this roadmap achieves execution, and 🚫 nothing should, until ADR L accounts for the revert.
