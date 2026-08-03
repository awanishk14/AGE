# ST_05 — The Studio Coverage Matrix

Status: **Proposed** · measured against `main` at **`1d43f6f`**, 2026-08-03.
🚫 Authorizes no code. ⚠️ **Re-measure before citing** — a matrix is a claim about the repo, and a
stale one is exactly the kind of confident falsehood this product exists to refuse.

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

---

## The matrix

| Screen                                                                                 | Backend package                                                         | API                         | Runtime                      | Status | Gap — what actually blocks it                                                                                                                         |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------- | ---------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L0 Login**                                                                           | —                                                                       | —                           | —                            |   🛑   | **The entire identity subsystem.** No principal, no session, no entitlement store. ADR-0058 D2/D7; ADR K unwritten.                                   |
| **S1 Dashboard**                                                                       | `@age/client-registry`                                                  | —                           | in-process                   |   ⚠️   | Businesses panel ✅. Every other panel (suggestions, intelligence, executions, knowledge, contradictions) has **no runtime**, not merely no endpoint. |
| **S2 Businesses**                                                                      | `@age/client-registry`                                                  | —                           | in-process                   |   ✅   | **None.** The one rich screen buildable today. Organizations render as a derived band (ADR-0058 D4).                                                  |
| **S3 Business Profile**                                                                | `@age/client-registry`                                                  | —                           | —                            |   ⚠️   | Name + ids ✅. **Every business attribute lives in a BIF**, and no BIF has been read. 🛑 ADR-0055 D7.                                                 |
| **S4 Discovery (render)**                                                              | `@age/business-discovery-contracts`                                     | —                           | in-process                   |   ✅   | **None for rendering** — 9 real sections, 17 real questions, real validation.                                                                         |
| **S4 Discovery (why-it-matters)**                                                      | `@age/business-discovery-contracts`                                     | —                           | —                            |   ❌   | The questionnaire has **no `rationale` field**. Must be added to the contract, 🚫 never authored in the UI.                                           |
| **S4 Discovery (submit)**                                                              | `apps/capture`                                                          | —                           | **CLI only**                 |   🛑   | Enabling submit is **runtime-caller wiring** — ADR-0054 §0.1d; ADR-0058 §6 q3.                                                                        |
| **S5 BIF viewer**                                                                      | `@age/bif` (**0 functions**)                                            | —                           | `produceScoredBifContext` ✅ |   🛑   | The mapper exists; **the read path does not**. ADR-0055 D7 — the operator's own onboarding run. 🚫 Do not seed a row.                                 |
| **S6 Evidence Timeline**                                                               | `@age/evidence-contracts` (**0 functions**)                             | —                           | —                            |   ⚠️   | **One producer of evidence exists (Discovery).** The other seven sources the owner named have no client at all.                                       |
| **S7 Contradictions**                                                                  | `@age/research-intelligence-engine` (**0 functions**)                   | —                           | —                            |   ❌   | **No detector.** `EvidenceConflict` is a type nothing computes. AGE's strongest differentiator is entirely unimplemented.                             |
| **S8 Knowledge Graph**                                                                 | `@age/business-knowledge-graph` (56 files, **0 functions**)             | —                           | —                            |   ❌   | Ontology ✅, **no builder, no traversal, no BIF→graph projection.** 🚫 No Neo4j (owner's answer, ADR-0057 q5).                                        |
| **S9 Strategy board**                                                                  | `@age/strategy-intelligence-engine` (35 files, **0 functions**)         | —                           | —                            |   ❌   | **The decision layer is contracts only.** No opportunity, recommendation, priority or roadmap is computed anywhere.                                   |
| **S10 Execution (approvals, read-only)**                                               | `packages/capabilities/*`                                               | `GET /demo/capabilities` ⚠️ | `@age/demo-runtime` ✅       |   ⚠️   | Six pending approvals are real — but only in **demo scope**. Needs a non-demo caller. 🚫 No Approve button.                                           |
| **S10 Execution (run/complete)**                                                       | —                                                                       | —                           | —                            |   🛑   | **Deliberately reverted** (PRs #41–#61). ADR-0057 q3 is OPEN. 🚫 Do not rebuild `@age/execution-contracts` to fill a screen.                          |
| **S11 History & diff**                                                                 | `@age/scored-bif-snapshot-persistence` ✅                               | —                           | —                            |   🛑   | Repository ✅, storage model ✅ (append-only). **Zero snapshots exist** and there is **no diff engine**.                                              |
| **S12 RankOps widget**                                                                 | `@age/integrations` (**0 functions**)                                   | —                           | —                            |   ❌   | **No RankOps client.** ADR-0057 q2 (which peer product first) is OPEN. Only the _Open in ↗_ link is honest today.                                     |
| **S12 MCP Ads widget**                                                                 | `@age/integrations` (**0 functions**)                                   | —                           | —                            |   ❌   | **No MCP Ads client.** Same as above.                                                                                                                 |
| **S13 Diagnostics**                                                                    | `@age/studio-shell` ✅ · `capabilities/*` ✅ · `@age/capability-kit` ✅ | `GET /health` ✅            | in-process ✅                |   ✅   | Packages, capabilities, readiness, bind host ✅. **Gaps:** queues (none exist), identity (does not exist), operator log store (none).                 |
| **System Status indicator**                                                            | `@age/studio-shell`                                                     | —                           | in-process                   |   ✅   | **None.** Its content is facts about AGE itself, all of which are knowable now.                                                                       |
| **Organizations mgmt** (create / invite / roles / permissions / subscriptions / usage) | —                                                                       | —                           | —                            |   🛑   | **Three independent blocks:** no tenant model · no identity · console is strictly read-only (ADR-0057 q1, answered).                                  |

---

## What the matrix says, in four lines

1. **Two screens are fully buildable today** — Businesses (S2) and Diagnostics (S13) — plus the
   System Status indicator and Discovery's rendering layer.
2. **The biggest single obstacle is not an endpoint. It is that 212 files of contracts export zero
   functions.** Five screens (S7, S8, S9, and both S12 widgets) are ❌ for that one reason.
3. **The second obstacle is one undischarged precondition** — ADR-0055 D7, the operator's own
   onboarding run — which alone blocks S3, S5 and S11.
4. **The third is a decision, not code** — the read-only answer versus a journey that begins with
   organization creation and member invites.

## API reality check

| Route                    | Exists?                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `GET /health`            | ✅                                                                                            |
| `GET /demo/capabilities` | ✅                                                                                            |
| Everything else          | ❌ — 22 controller modules, all placeholders whose own comments say _"no routes defined yet"_ |

⚠️ 🚫 **Do not read those 22 modules as "the API is nearly there."** They are empty shells around
services over a placeholder Prisma schema (ADR-0042). Counting them as coverage is exactly the class
of error this matrix exists to prevent.
