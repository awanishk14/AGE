# ST_05 — The Studio Coverage Matrix

Status: **Proposed** · measured against `main` at **`aa2a69f`**, 2026-08-08.
🚫 Authorizes no code. ⚠️ **Re-measure before citing** — a matrix is a claim about the repo, and a
stale one is exactly the kind of confident falsehood this product exists to refuse.

> ⚠️ **RE-MEASURED 2026-08-08 (#255 → this PR), fifteen slices after the previous measurement at
> `1d43f6f`.** Every row below was checked against `main` by reading the code, 🚫 not by carrying a
> claim forward from the previous revision of this document. **Six rows changed status**, and two of
> them changed because the previous revision was **wrong**, not because work shipped:
>
> - 🛑 **L0 Login said _"ADR K unwritten"_. That was FALSE from #249** — ADR K is
>   `docs/adrs/0061-identity-and-the-hosted-shape.md`, written and `Status: Proposed`. ⚠️ The row's
>   **🛑 status is unchanged**: a written `Proposed` ADR is not an implemented subsystem.
> - 🛑 **Organizations said _"no tenant model"_. That is FALSE since #253** — **ADR-0062 D1** freezes
>   the tenant as the **ORGANIZATION**, accepted by the Product Owner. ⚠️ Its **🛑 status is also
>   unchanged**: ADR-0062 §3 says in its own words that it **authorizes no code**.
>
> ⚠️ Both corrections make the row's _reason_ honest while leaving the row blocked. That is the
> normal case here — **the previous revision already recorded that the decision layer moved fewer
> rows than expected**, and it is still true.

---

## Legend

|     | Meaning                                                                      |
| --- | ---------------------------------------------------------------------------- |
| ✅  | **Works or is buildable now** — the data and the logic both exist            |
| ⚠️  | **Partial** — a contract/model exists, the runtime that computes it does not |
| ❌  | **Gap** — nothing in the repo provides this                                  |
| 🛑  | **Blocked by an accepted decision** — the code is not the obstacle           |

⚠️ **"Needs API" and "needs runtime" are not the same gap.** An endpoint over a package that exports
zero functions would have nothing to call. The `Gap` column names the _real_ obstacle.

⚠️ **"Shipped" is a stronger claim than "buildable", and this revision distinguishes them.** A ✅ row
that names a route under `apps/studio/src/app/` is running on `main` today; a ✅ row without one is
buildable and not built.

---

## The matrix

| Screen                                                                                 | Backend package                                                         | API                         | Runtime                | Status | Gap — what actually blocks it                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------- | ---------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L0 Login**                                                                           | `@age/entitlement` (**1 function, 0 callers**)                          | —                           | —                      |   🛑   | **The entire identity subsystem.** No principal, no session, no entitlement store. ⚠️ **ADR K IS NOW WRITTEN — it is ADR-0061 (#249), `Status: Proposed`**, and 🚫 must not be self-accepted. ADR-0062 answered its **Q1** only; **Q2–Q6 are open**. `askEntitlement` returns `not-established` for every subject and 🚫 has no caller, deliberately. |
| **S1 Dashboard**                                                                       | `@age/studio-shell` `dashboard-view.ts` ✅                              | —                           | in-process             |   ⚠️   | ⚠️ **SHIPPED** (`/`). The Businesses panel is real; the other four (needs-attention, intelligence, contradictions, and the area cards) render `not-assessed` **with a reason**, because they have **no runtime** — not merely no endpoint. 🚫 The panels are not placeholders to be filled with a number.                                             |
| **S2 Businesses**                                                                      | `@age/client-registry` (9 functions)                                    | —                           | in-process             |   ✅   | **None.** ⚠️ **SHIPPED** (`/businesses`, `/businesses/new`). Organizations render as a derived band (ADR-0058 D4) — 🚫 no route, no picker, no "current organization" in state.                                                                                                                                                                       |
| **S3 Business Profile**                                                                | `@age/client-registry`                                                  | —                           | in-process             |   ⚠️   | Name + ids ✅. **Every business attribute lives in a BIF**, and the BIF now reachable is the one produced from the **answer file** (see S5), not a persisted one. 🛑 ADR-0055 D7 still blocks anything read from the capture store. 🚫 Do not seed a row.                                                                                             |
| **S4 Discovery (render)**                                                              | `@age/business-discovery-contracts` (15 functions)                      | —                           | in-process             |   ✅   | **None.** ⚠️ **SHIPPED** (`/b/[clientId]/discovery`) — 9 real sections, 17 real questions, real validation.                                                                                                                                                                                                                                           |
| **S4 Discovery (why-it-matters)**                                                      | `@age/studio-shell` `discovery-rationale.ts` ✅                         | —                           | in-process             |   ✅   | ⚠️ **CHANGED FROM ❌ (#246, ADR-0059 D6).** The previous revision said a `rationale` field must be added to the contract. It was solved **differently and better**: the field name is read from the mapper's own `PROFILE_SIGNAL_TARGETS`, so a renamed field cannot leave a stale name on screen. 🚫 It never motivates and never scores.            |
| **S4 Discovery (submit)**                                                              | `@age/operator-workspace` `submitDiscoveryAnswers` ✅                   | —                           | in-process             |   ✅   | ⚠️ **CHANGED FROM 🛑.** The console writes the answer file itself (Knowledge Authoring, class 1). ⚠️ The path is **never defaulted** (ADR-0054 D2) and an incomplete draft is **refused, not padded**. 🚫 This is not `produceAndCapture` — ADR-0046 D7 stands.                                                                                       |
| **S5 BIF viewer**                                                                      | `@age/bif` (**0 functions**) · `produceScoredBifContext` ✅             | —                           | in-process             |   ⚠️   | ⚠️ **CHANGED FROM 🛑.** `generateBifFromAnswerFile` produces and renders a real Draft BIF from the operator's answer file. 🛑 **The persisted read path is still blocked** by ADR-0055 D7 — nothing has read the capture store.                                                                                                                       |
| **S6 Evidence Timeline**                                                               | `@age/evidence-contracts` (**0 functions**) · `assembleEvidence` ✅     | —                           | in-process             |   ⚠️   | ⚠️ **SHIPPED** (`/b/[clientId]/evidence`). **One producer of evidence exists (Discovery).** The other seven sources the owner named (ADR-0056) have **no client at all**.                                                                                                                                                                             |
| **S7 Contradictions**                                                                  | `@age/intelligence` `detectContradictions` (7 functions)                | —                           | in-process             |   ⚠️   | ⚠️ **SHIPPED as a REFUSAL** (`/b/[clientId]/contradictions`). A detector exists and works — 🚫 do not build a second one. 🛑 **It is not run and there is no import path to it**: over an empty `Evidence` list it returns an empty set, which would render as a **clean bill of health**. The screen reports which preconditions the capture fails.  |
| **S8 Knowledge Graph**                                                                 | `@age/business-knowledge-graph` (56 files, **0 functions**)             | —                           | —                      |   ❌   | Ontology ✅, **no builder, no traversal, no BIF→graph projection.** 🚫 No Neo4j (owner's answer, ADR-0057 q5).                                                                                                                                                                                                                                        |
| **S9 Strategy board**                                                                  | `@age/strategy-intelligence-engine` (35 files, **0 functions**)         | —                           | —                      |   ❌   | ⚠️ Route exists (`/b/[clientId]/strategy`) and correctly renders **not-assessed**. **The decision layer is contracts only** — no opportunity, recommendation, priority or roadmap is computed anywhere. Needs an engine, its own slice and a `Proposed` ADR **first**.                                                                                |
| **S10 Execution (approvals, read-only)**                                               | `packages/capabilities/*`                                               | `GET /demo/capabilities` ⚠️ | `@age/demo-runtime` ✅ |   ⚠️   | Six pending approvals are real — but only in **demo scope**. Needs a non-demo caller. 🚫 No Approve button.                                                                                                                                                                                                                                           |
| **S10 Execution (run/complete)**                                                       | —                                                                       | —                           | —                      |   🛑   | **Class 3 under ADR-0057 D4 — refused, not postponed.** 🚫 A "preview" or "dry run" button is still class 3. Deliberately reverted (PRs #41–#61); 🚫 do not rebuild `@age/execution-contracts` to fill a screen.                                                                                                                                      |
| **S11 History & diff**                                                                 | `@age/scored-bif-snapshot-persistence` (8 functions) ✅                 | —                           | —                      |   🛑   | Repository ✅, storage model ✅ (append-only). **Zero snapshots exist** and there is **no diff engine**. 🛑 ADR-0055 D7 — the operator's own onboarding run. 🚫 **DO NOT SEED A ROW.**                                                                                                                                                                |
| **S12 RankOps widget**                                                                 | `@age/integrations` (**0 functions**)                                   | —                           | —                      |   ❌   | **No RankOps client.** ADR-0057 q2 (which peer product first) is OPEN, and it needs a real client. Only the _Open in ↗_ link is honest today.                                                                                                                                                                                                         |
| **S12 MCP Ads widget**                                                                 | `@age/integrations` (**0 functions**)                                   | —                           | —                      |   ❌   | **No MCP Ads client.** Same as above.                                                                                                                                                                                                                                                                                                                 |
| **S13 Diagnostics**                                                                    | `@age/studio-shell` ✅ · `capabilities/*` ✅ · `@age/capability-kit` ✅ | `GET /health` ✅            | in-process ✅          |   ✅   | ⚠️ **SHIPPED** (`/diagnostics`). **Gaps:** queues (none exist), identity (does not exist), operator log store (none).                                                                                                                                                                                                                                 |
| **System Status indicator**                                                            | `@age/studio-shell` `system-status.ts` ✅                               | —                           | in-process             |   ✅   | **None.** ⚠️ **But #254 removed a false facet from it** — it claimed a startup refusal that no code performed. 🚫 It must never say "refuses to start" again unless a startup refusal really runs.                                                                                                                                                    |
| **Local MCP surface** (`apps/mcp`)                                                     | `@age/operator-workspace` (11 functions)                                | stdio, **binds nothing**    | in-process             |   ✅   | ⚠️ **NEW ROW — SHIPPED (#251).** Read-and-author tools over the same workspace. 🚫 **No `execute_*`, no `onboard`, no sampling.** 🚫 **Adding a tool needs its own ADR** (ADR-0060 D8 is discharged).                                                                                                                                                 |
| **Organizations mgmt** (create / invite / roles / permissions / subscriptions / usage) | —                                                                       | —                           | —                      |   🛑   | ⚠️ **The tenant model IS now decided — ADR-0062 D1, the ORGANIZATION** (#253, by the Product Owner). 🛑 The row stays blocked on **identity**, which does not exist: roles, permissions and member access wait on **ADR-0061**. 🚫 ADR-0062 §3 authorizes no code, and 🚫 ADR-0058 D4 is not repealed. 🚫 An invitation is never an access grant.     |

---

## What the matrix says, in five lines

1. **Eleven surfaces are shipped and running on `main`** — S1, S2, S4 (render, why-it-matters,
   submit — three), S5, S6, S7, S13, System Status, and the local MCP surface. ⚠️ Several ship a
   **refusal or a `not-assessed`** as their honest content; that is a shipped screen, not a stub.
2. **The biggest single obstacle is still not an endpoint. It is that 107 files of contracts export
   zero functions** — `@age/business-knowledge-graph` 56, `@age/strategy-intelligence-engine` 35,
   `@age/integrations` 16, counted at `aa2a69f`. ⚠️ The previous revision's figure of 212 covered a
   **different set** and is 🚫 not comparable: `@age/bif` (29 files, still 0 exported functions) and
   `@age/evidence-contracts` (6, likewise) are now **reached through functions that live elsewhere**,
   so they no longer block a screen. Four screens (S8, S9, both S12 widgets) are ❌ for this reason.
3. **The second obstacle is one undischarged precondition** — **ADR-0055 D7**, the operator's own
   onboarding run — which still caps S3 and blocks S11 entirely. ⚠️ It no longer blocks S5: the BIF
   is now produced from the **answer file**, a path that does not touch the capture store.
4. **The third obstacle is identity, and it is now a written question rather than an unwritten one.**
   ADR-0061 exists and is `Proposed`; ADR-0062 answered its Q1 (the tenant is the organization) and
   🚫 explicitly authorized nothing. L0 and Organizations both wait on the **rest** of ADR-0061.
5. 🛑 **One row is refused rather than blocked.** S10 (run/complete) is **class 3 under ADR-0057
   D4** — 🚫 it is not waiting for anything, and no future slice unblocks it without a new ADR.

## API reality check

| Route                    | Exists?                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `GET /health`            | ✅                                                                                            |
| `GET /demo/capabilities` | ✅                                                                                            |
| Everything else          | ❌ — 22 controller modules, all placeholders whose own comments say _"no routes defined yet"_ |

⚠️ **Re-checked at `aa2a69f`: still exactly two route-bearing modules in `apps/api/src`.**
⚠️ 🚫 **Do not read those 22 modules as "the API is nearly there."** They are empty shells around
services over a placeholder Prisma schema (ADR-0042). Counting them as coverage is exactly the class
of error this matrix exists to prevent.

⚠️ **And note what the shipped surfaces did NOT need:** every ✅ above runs **in-process**, with no
new endpoint. 🚫 Do not treat "needs an API" as the default next step for a blocked row — for most
of them it was never the obstacle.
