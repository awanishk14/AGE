# AGE Studio — the product design set

Status: **Proposed** · Date: 2026-08-03 · Author: architect, under the standing grant
🚫 **This set authorizes no code.** It is a design record. Every screen in it is described whether or
not anything can build it, because the point of the exercise is to see the gap.

---

## 0. Why this exists, and what changed

The Product Owner's direction of 2026-08-03 (the second message of that day) reverses the
implementation-first instruction of the first:

> _"You are no longer implementing isolated technical slices… The UI is NOT a feature. The UI IS THE
> PRODUCT… Never ask 'what backend should I build?' Always ask 'what should the operator see?' Then
> derive the backend required to support that screen… Only after the entire product experience is
> coherent should implementation continue."_

⚠️ **Both instructions are recorded, and the later one governs.** The earlier one cancelled a Screen
Specification; this one requires a larger version of it. That is the owner's call and this set is the
response. 🚫 Do not cite the earlier instruction to skip this work, and 🚫 do not cite this one to
reopen the refusals in §3 of `CLAUDE.md` — a design document is not an authorization.

## 1. The set

| Doc                                 | What it is                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| `ST_01_INFORMATION_ARCHITECTURE.md` | The navigation tree, the three levels, and what is refused as an area and why                 |
| `ST_02_SCREENS.md`                  | Every screen: its question, its wireframe, its components, its states, its backend dependency |
| `ST_03_FLOWS.md`                    | The operator journeys end to end, and where each one currently stops                          |
| `ST_04_COMPONENTS_AND_STATES.md`    | The component inventory and the state matrix every component must implement                   |
| **`ST_05_COVERAGE_MATRIX.md`**      | **The Studio Coverage Matrix** — screen × package × API × status × gap                        |
| `ST_06_GAP_ANALYSIS_AND_ORDER.md`   | What is missing, what is blocked by a decision, and the order to build in                     |

**Read `ST_05` first if you read only one.** It is the document the owner asked for by name and it is
where the architecture's real shape becomes visible.

## 2. The finding that dominates every other

AGE has an **extensive contract layer and almost no runtime**. First measured on `main` at
`1d43f6f`; ⚠️ **re-counted at `aa2a69f` on 2026-08-08 and every row below is UNCHANGED** — 212 files,
0 exported functions, fifteen slices later.

⚠️ **But the consequence changed, and `ST_05` is where that is recorded.** Two of these packages no
longer block a screen: `@age/bif` and `@age/evidence-contracts` are now reached through functions
that live **elsewhere** (`produceScoredBifContext`, `@age/operator-workspace`). 🚫 Do not read a `0`
in this table as "that screen is impossible" — read `ST_05`'s row for the real obstacle.

| Package                             |   Files | Exported functions |
| ----------------------------------- | ------: | -----------------: |
| `@age/bif`                          |      29 |              **0** |
| `@age/business-knowledge-graph`     |      56 |              **0** |
| `@age/research-intelligence-engine` |      40 |              **0** |
| `@age/strategy-intelligence-engine` |      35 |              **0** |
| `@age/knowledge`                    |      30 |              **0** |
| `@age/integrations`                 |      16 |              **0** |
| `@age/evidence-contracts`           |       6 |              **0** |
| **Total**                           | **212** |              **0** |

And `apps/api` has **22 controller modules with 2 live routes** — `GET /health` and
`GET /demo/capabilities`. Every other controller is a placeholder whose own comment says
_"Placeholder; no routes defined yet."_

⚠️ **The consequence for this design set:** most screens are **not** blocked on an endpoint. They are
blocked on a **runtime that does not exist**. An endpoint over a package that exports no functions
would have nothing to call. 🚫 Do not write "needs API" where the truth is "needs an engine" — the
matrix distinguishes them, because the two have different costs by an order of magnitude.

## 3. What is honestly buildable today

Three things, and they are the reason the near-term order in `ST_06` looks the way it does:

1. **The questionnaire is real.** `@age/business-discovery-contracts` holds a complete default
   questionnaire — **9 sections, 17 questions**, with per-question `entryKind` enums. Discovery's UI
   can be built against it today with **no invented content**.
2. **Client records are real.** `@age/client-registry` resolves a named business from the operator's
   own file, and `organizationId` is derived from that record.
3. **Six capabilities have real functions** and a real readiness entry point, and the demo runtime
   already drives them end to end.

Everything downstream of the BIF — the graph, contradictions, strategy, execution, snapshot
comparison — is types only.

## 4. Standing constraints this set does not override

🚫 A design document cannot discharge a decision. These still hold, and `ST_02` marks every screen
they touch:

- **ADR-0055 D7** — no read path until one real business has passed through the shipped CLI path.
  🚫 Do not seed a row. This blocks every screen that reads a snapshot.
- **ADR-0057 D2 (OX-INV-1)** — Studio binds loopback or refuses. No flag, no override.
- **ADR-0057 open question 1, answered then CLARIFIED (§0.7) — the THREE ACTION CLASSES of D4.**
  🚫 The term "read-only" is **retired**. ✅ **Platform Administration** (create organization, invite
  members, create client, configure integrations) and ✅ **Knowledge Authoring** (discovery, generate
  BIF, manual notes, attach evidence) are **allowed in V1**. 🚫 **Business Execution** — RankOps, MCP
  Ads, publishing, campaigns, **anything affecting an external system** — is **refused**, and 🚫 so is
  anything scheduled, queued or acted on AGE's own initiative, however internal its effect.
  **Invariant:** _"Human-authored knowledge is permitted. System-initiated execution remains prohibited
  until the execution layer is enabled."_ ⚠️ Three things this does **not** unblock: 🛑 **Invite
  Members grants no access** (no identity to grant it to — §0.7 note 1) · 🛑 **no credential storage**
  (§0.7 note 2) · 🛑 **ADR-0055 D7 and ADR-0054 D6 are untouched.**
- **ADR-0058 D2/D7 (`Proposed`)** — there is no authenticated identity; the entitlement answer is
  "not established". This blocks **Login**, which is step 1 of the owner's journey.
- **ADR-0058 D4 (`Proposed`)** — Organizations is a derived band, not a route.
- **ADR-0057 open question 3, OPEN** — execution was deliberately reverted (PRs #41–#61).
- **`18_AGE_STUDIO.md` §7.1** — mock data may never invent values for a real business.
