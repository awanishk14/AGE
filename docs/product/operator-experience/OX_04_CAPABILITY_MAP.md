# Phase 4 — Existing Capability Mapping

> The audit that constrains every other phase. Nothing orphaned, nothing duplicated, and every screen
> element traced to something that exists. **Status: Proposed.**

---

## 1. Packages → destination

All 27 workspace packages. **Destination** is where the operator sees its effect — never a screen
named after the package.

| Package                                      | Destination              | Notes                                                                 |
| -------------------------------------------- | ------------------------ | --------------------------------------------------------------------- |
| `@age/bif`                                   | **S5** (12 sections), S3 | Consumed, never modified. 🚫 Capability packages must never import it |
| `@age/business-discovery-contracts`          | **S4**, S5               | Holds `produceScoredBifContext` — the **only** Discovery→BIF mapping  |
| `@age/discovery-answer-file`                 | **S4**                   | Parse/validate against the questionnaire                              |
| `@age/operator-file-policy`                  | **S4**, S13              | Path rule + JSON-refusal rule, one implementation each                |
| `@age/client-registry`                       | **S2**, S3               | Records + `OperatorPrincipal`                                         |
| `@age/business-discovery-capture`            | **S4** (confirmed write) | Capture orchestration                                                 |
| `@age/scored-bif-snapshot-persistence`       | **S11**, S3, S5          | ⚠️ Write path exists; **read path does not** — G-1                    |
| `@age/persistence`                           | S13 (target only)        | Prisma, RLS. 🚫 Never surfaced directly                               |
| `@age/evidence-contracts`                    | **S6**, S7               | `EvidenceSource`, `SignalType`, `EvidenceState`, `Polarity`           |
| `@age/capabilities/*` (6)                    | **S8**                   | See §2                                                                |
| `@age/capability-kit`                        | S8                       | `ClientContext`, capability protocol                                  |
| `@age/authority-contracts`                   | S8 (Authority)           | Capability I/O types                                                  |
| `@age/growth-contracts`                      | S8 (Growth)              | "                                                                     |
| `@age/market-discovery-contracts`            | S8 (Market Discovery)    | "                                                                     |
| `@age/operations-contracts`                  | S8 (Operations)          | "                                                                     |
| `@age/revenue-contracts`                     | S8 (Revenue)             | "                                                                     |
| `@age/strategy-intelligence-engine`          | **S9**                   | ⚠️ **Orphan** — no caller. G-6                                        |
| `@age/research-intelligence-engine`          | **S6**                   | ⚠️ **Orphan** — sources/extractors exist, nothing invokes them. G-3   |
| `@age/business-knowledge-graph`              | _(none)_                 | ⚠️ **Orphan** — no producer. Deferred, G-11                           |
| `@age/knowledge`                             | _(none)_                 | ⚠️ **Orphan** — G-11                                                  |
| `@age/integrations`                          | **S12**                  | Provider contracts; no peer client. G-8                               |
| `@age/demo-runtime`                          | `/demo` only             | 🚫 **Never reused by the console.** Frozen fictional scenario         |
| `@age/ui`                                    | rendering                | Component layer                                                       |
| `@age/sdk`                                   | —                        | Consumer surface                                                      |
| `@age/config` · `@age/shared` · `@age/types` | —                        | Infrastructure, no destination                                        |

**Duplication check.** One element, one home:
`produceScoredBifContext` → S4 only (S5 renders its stored result, never recomputes) · client records
→ S2 only (S3 shows the selected one) · snapshots → S11 only (S3 shows the latest, S5 renders its
projection) · evidence → S6 only (S5 links, S7 shows conflicts).

---

## 2. The six capabilities

| Capability           | Produces                                                | Readiness entry point | Screen  |
| -------------------- | ------------------------------------------------------- | --------------------- | ------- |
| **Intelligence**     | `intelligence-output-item`, business-context assessment | ✅ Yes                | S8      |
| **Market Discovery** | `market-discovery-opportunity-item`                     | ✅ Yes                | S8 → S9 |
| **Revenue**          | `revenue-plan-item`                                     | ✅ Yes                | S8 → S9 |
| **Authority**        | `authority-plan-item`                                   | ❌ No                 | S8      |
| **Growth**           | `growth-plan-item`                                      | ❌ No                 | S8      |
| **Operations**       | `operations-plan-item`                                  | ❌ No                 | S8      |

⚠️ **The asymmetry is deliberate and must be rendered, not smoothed.** Three capabilities adopt the
ADR-0027 context-readiness pattern and three do not. S8 shows readiness for the three that have it and
says nothing for the other three — 🚫 it must not invent a readiness figure for Authority, Growth or
Operations, and must not imply the absence means "ready".

⚠️ Readiness is a **separate named entry point, never a gate on `run`**, and `consumes` must never
gain `ScoredBifContext`.

---

## 3. The 12 BIF sections → S5

`organization-identity` · `products-services` · `icp-personas` · `market-competition` ·
`brand-system` · `gtm-system` · `marketing-intelligence` · `vision-strategy` · `kpis` ·
`constraints` · `assets` · `technology-stack`.

Each renders as **populated** or **omitted**. The demo baseline is 7 populated + 5 omitted; a real
business will differ. 🚫 No section is ever placeholder-filled, and omission is never a zero.

---

## 4. The 15 questionnaire questions → S4

`age-business-discovery` / `2026.1`:

| Section              | Questions                                  | Kind     |
| -------------------- | ------------------------------------------ | -------- |
| business-identity    | `bi-name`, `bi-industry`                   | text     |
|                      | `bi-model`                                 | longText |
| offerings            | `off-products`, `off-services`             | list     |
| customers-icp        | `icp-segments`                             | list     |
| market-competition   | `mkt-geographies`, `mkt-competitors`       | list     |
| positioning-brand    | `brand-positioning`                        | longText |
| channels             | `ch-current`                               | list     |
| goals-constraints    | `gc-goals`, `gc-constraints`               | list     |
| assets               | `as-available`                             | list     |
| evidence-assumptions | `ev-documents`, `ev-urls`, `ev-statements` | list     |
|                      | `ev-assumptions`                           | longText |

⚠️ `choice` questions are validated against declared choices, and the refusal 🚫 does not echo the
supplied value. A console rendering that refusal must not add the value back.

---

## 5. Existing UI surface

| Exists                              | Destination                                                                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `apps/web` `/` (12 lines)           | Replaced by S1                                                                                                              |
| `apps/web` `/demo` (435 lines)      | 🚫 **Untouched.** Stays frozen and fictional                                                                                |
| `apps/api` `GET /health`            | S13                                                                                                                         |
| `apps/api` `GET /demo/capabilities` | 🚫 **Untouched**                                                                                                            |
| `apps/api` — 18 other controllers   | ⚠️ **Scaffolds with no HTTP decorator.** `status()` is not routed. They are not endpoints and must not be described as ones |

---

## 6. Capabilities with no visible destination

| Orphan                                            | Why                                                                                        | Gap  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---- |
| `@age/strategy-intelligence-engine`               | Analysis, opportunities, prioritization, recommendations, roadmaps, simulation — no caller | G-6  |
| `@age/research-intelligence-engine`               | Sources, extractors, normalizers, validators — nothing invokes them                        | G-3  |
| `@age/business-knowledge-graph`, `@age/knowledge` | No producer for a real business                                                            | G-11 |
| Snapshot **read** path                            | Write exists; `CaptureConnection` exposes only `{ orchestrator, close }`                   | G-1  |
| 18 API scaffold controllers                       | Placeholders for a product not yet built                                                   | —    |

⚠️ **The two engines are the largest orphans in the repository.** SIE and RIE together are a
substantial amount of built, tested, unreachable code. Phase 5 treats wiring them as the highest-value
gaps after the read path — this is architect finding 11: _a track that reports itself blocked is
usually blocked on a track, not on the product._

---

## 7. Screens needing capabilities that do not exist

| Screen          | Needs                                        | Gap       |
| --------------- | -------------------------------------------- | --------- |
| S1, S3, S5, S11 | Snapshot read path                           | G-1       |
| S8              | Runtime caller feeding a real stored context | G-2       |
| S6              | Evidence ingestion                           | G-3       |
| S7              | Contradiction detection over real evidence   | G-4       |
| S7              | Adjudication (a write)                       | G-5       |
| S9              | SIE wiring                                   | G-6       |
| S10             | Execution + approval (**reverted**)          | G-7       |
| S12             | Peer contract clients                        | G-8       |
| —               | Search, notifications, task queue            | G-9/10/12 |
| —               | Knowledge graph producer                     | G-11      |

**Every remaining screen element traces to existing code.** S2, S4 and S13 are buildable today; S3,
S5 and S11 are buildable the moment G-1 lands. That is the roadmap's opening, and Phase 7 uses it.
