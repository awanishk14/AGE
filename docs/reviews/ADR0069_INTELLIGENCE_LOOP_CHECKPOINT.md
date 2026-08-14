# ADR-0069 — the cross-system intelligence loop: checkpoint

> Extracted **verbatim** from `CLAUDE.md` §1 on 2026-08-13 (after #312), because that file crossed
> its 40k hard limit. 🚫 Nothing was dropped or reworded. Read this before undoing anything on the
> ADR-0069 track.

## #310 — the relay CLI (main `0a9adc3`)

> ✅ **#310 — THE RELAY CLI: `age-capture relay`, THE ONLY DOOR AN OBSERVATION ENTERS BY**
> (main `0a9adc3`, post-merge CI green, **15 steps**; `ci-db.yml` also ran, 18). D7 needed a second
> producer and there was **none**. This is the **OPERATOR'S OWN ACT**, out of band.
> 🛑 **THE ORDER IS THE ARGUMENT:** arguments → client record (an unknown client opens **NO**
> connection) → the observation as **untrusted** input → the scope check → the stored BIF →
> admissibility → **only then** an append handle. 🛑 **NOTHING BEFORE THAT CAN WRITE, AND NOT
> BECAUSE IT DECLINES TO** — the append connection is a **function on the runtime**, so a refusing
> or unconfirmed run never holds one; ⚠️ the suite asserts it by **COUNTING HANDLES OPENED**, 🚫 not
> by reading output. 🚫 **`--append` IS A DIFFERENT WORD FROM `--capture`** on purpose, and each
> half without the other is an error. 🚫 `--organization-id`, `--source-system`, `--subject`,
> `--observation-id`, `--recorded-at`, `--all`, `--directory` are refused **BY NAME** — "Unknown
> flag" reads as a typo. 🛑 **THE SOURCE'S `organizationScope` IS CHECKED AND NEVER USED** — a
> mismatch REFUSES rather than filing the row under the typed scope. 🛑 **`contextNotFound` IS ITS
> OWN EXIT CODE** — no stored context means the check **was never run**, 🚫 never `inadmissible`.
> ⚠️ The composition purity guard is now **BOUNDED TO ONE FUNCTION** (it had sliced to end-of-file),
> with a sibling guard on the write door. 🚫 ADR-0060 §6 Q1 STILL UNANSWERED.

## #311/#312 — the rule asked of a row, then put on a screen (verbatim, extracted from CLAUDE.md §1)

> ✅ **#311/#312 — THE RULE ASKED OF A ROW, THEN PUT ON A SCREEN** (main `6155e77`, post-merge CI
> green, **15 steps**). 🛑 **A ROW IS NOT PROMOTED TO AN ENVELOPE** — rebuilding one invents back
> the `organizationScope` the SOURCE asserted, a fabricated provenance; `assessAdmissibility` and
> `associateObservation` widened to `SubjectBearingObservation` instead.
> 🛑 **`deriveIntelligenceFromStoredObservations` SHARES ONE CORE** with `deriveIntelligence` —
> asserted by **byte-identical output**, 🚫 not by trust; 🚫 the row path reads `organizationId` for
> NOTHING (scope is the caller's). 🛑 **`readDerivedIntelligence` IS THE ONLY OPERATION THAT READS
> TWO STORES, AND THE ORDER IS THE ARGUMENT:** blank BIF id refuses → scope (an unknown business
> opens **NEITHER** connection) → the **context** port → `null` → **`no-context`** → **only then**
> the observation port. 🛑 **NO STORED CONTEXT MEANS THE DERIVATION NEVER RAN** — its own outcome
> and its own heading, 🚫 never "nothing concluded", and the observation store is not even opened.
> 🛑 **NO OBSERVATIONS IS NOT AN ERROR** — the projection names every modelled subject nobody
> reported on. 🚫 The orchestration and the panel DECIDE NOTHING (no filter, no re-order); 🚫 the
> three Intelligence answers stay three, nothing reconciles or ranks them; 🚫 no write, no "save
> this conclusion" (D2 recomputes every press), no relay button on a read screen.

## #314 — the Sources area names what it does not cover (verbatim, extracted from CLAUDE.md §1)

> ✅ **#314 — THE SOURCES AREA NAMES WHAT IT DOES NOT COVER** (main `3efb9f9`, post-merge CI
> green, **15 steps**). 🛑 **IT IS A POINTER, 🚫 NEVER A SECOND COPY** — rendering relayed
> observations on Sources too would make TWO screens answer "what did a source report", and the
> copy that drifts still looks authoritative. 🚫 **THE SENTENCE CLAIMS NOTHING ABOUT THE
> OBSERVATION STORE** — from Sources AGE has not looked, and the spec forbids "no observations" /
> "nobody has reported" BY NAME (D5). ⚠️ `describeSourcesCoverage()` is the ONE implementation, in
> `@age/studio-shell`; 🚫 the screen writes no prose of its own.

## #315 — the projection, and the surface that cannot exist yet (verbatim, extracted from CLAUDE.md §1)

> ✅ **#315 — THE PROJECTION, AND THE SURFACE THAT CANNOT EXIST YET** (main `5676a5d`, post-merge
> CI green, **15 steps**). ADR-0069 deliverable 7's projection half: `projectClientContext`
> (`@age/client-context-projection`) answers ONE question, **"what may I name?"**, because
> admissibility is BY SUBJECT (D4). 🛑 **THE MCP TOOL IS DELIBERATELY NOT BUILT AND THAT IS THE
> REPORTED CONFLICT, 🚫 NOT AN OVERSIGHT** — "entitled on read" is unreachable while the only
> `Authentication` constructible is `none`, so a tool through `readWithinEntitlement` would refuse
> every call; it waits on token verification (ADR-0068 §0.1b). 🚫 **DO NOT CLOSE THAT GAP** by
> inventing a session, defaulting an organization or skipping the entitlement question — a guard
> forbids `token`/`session`/`cookie`/`bearer`/`express`/`listen(` in the package BY NAME.
> 🛑 **ONE READING RULE, SHARED** — subjects come from `deriveModelledSubjects`, the SAME function
> admissibility is assessed against; a second reading would advertise a subject AGE would refuse
> to relate. 🚫 **NO SCORE CROSSES** — the **KEY SET IS PINNED, NOT SEARCHED**: the substring scan
> missed `bifCompletenessScore` on casing when the guard was made to fail. 🚫 **NOTHING IS
> EMPTY-BY-OMISSION** — every subject kind appears; `never-captured` and `captured-nothing-recorded`
> stay apart and 🚫 NEITHER SAYS THE BUSINESS HAS NONE. ⚠️ **`asOf` IS A PARAMETER, 🚫 NEVER A
> CLOCK.**

## #317 — the peer's own answer, read for a screen (verbatim, extracted from CLAUDE.md §1)

> ✅ **#317 — THE PEER'S OWN ANSWER, READ FOR A SCREEN** (main `6a42f77`, post-merge CI green,
> **15 steps**). `readClientContextProjection` is `@age/operator-workspace`'s THIRTEENTH operation
> and #315's first caller. 🛑 **THE OPERATOR SEES THE PEER'S ANSWER, 🚫 NOT A DESCRIPTION OF IT** —
> asserted by **BYTE-IDENTICAL EQUALITY** with `projectClientContext`, so 🚫 no friendlier console
> wording can grow beside it. 🛑 **IT OPENS ONE STORE AND ONLY ONE** — the observation store is not
> opened, not read, not needed; mixing in what a source REPORTED would turn a statement about AGE's
> own model into one about what the world has said. ⚠️ **HANDLES ARE COUNTED, 🚫 NOT INFERRED FROM
> OUTPUT.** 🛑 **NO STORED CONTEXT IS ITS OWN OUTCOME**, 🚫 never an empty subject list; ⚠️ `asOf` is
> the stored `capturedAt`, 🚫 never a clock; 🚫 an unknown business opens NO connection and a blank
> BIF id refuses BEFORE the scope resolves. 🛑 **NO PEER CAN ASK YET AND THE CODE SAYS SO** —
> 🚫 do not close that with a session, a token or a route.
