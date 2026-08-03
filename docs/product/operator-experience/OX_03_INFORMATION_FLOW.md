# Phase 3 — Information Flow

> Per screen: inputs, outputs, dependencies, events, data ownership, persistence, refresh,
> relationships. **Status: Proposed.** Governed by ADR-0057.
>
> ⚠️ Rows marked **[GAP-n]** describe a dependency that **does not exist**. They are specified so the
> screen is unambiguous, and they are 🚫 not authorization to build the dependency. See Phase 5.

---

## 0. Rules that apply to every screen

**Data ownership.** Exactly four owners, and no screen may blur them:

| Owner                         | Holds                                             | Console's relationship                                   |
| ----------------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| The **operator's filesystem** | Answer file, client record file                   | Reads; may write only the answer file                    |
| **PostgreSQL** (`age_app`)    | Snapshots, append-only                            | Reads; appends only under confirmed write                |
| **Pure packages**             | Every derivation — mapping, scoring, capabilities | Calls; never reimplements                                |
| **Peer products**             | Their own data                                    | Requests over a public contract; never stores as its own |

**Persistence.** The console persists nothing of its own. It has no tables, no cache, no session
store, no local storage of business data. Every screen is a projection of one of the four owners
above.

**Refresh.** All screens are **request-scoped and pull-only**. There is no polling, no websocket, no
subscription, no timer. This is not a performance decision — 🚫 ADR-0054 D6 condition 5 forbids
background execution, scheduling and automation, and a poller is all three.

**Events.** The system has **no event bus** and this program does not introduce one. "Events" below
means _user-initiated interactions_, nothing more.

**Errors.** Every screen renders the **domain's own refusal text**. 🚫 Never a driver message, never
`error.message` from a caught parse failure, never a stack.

---

## S1 — Console Home

|                   |                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Inputs**        | Client record file path (config); for each record, the latest snapshot's summary **[GAP-1]**                          |
| **Outputs**       | Business list with last-captured time and top-line state; console health from S13; refusals encountered while loading |
| **Dependencies**  | `@age/client-registry`, snapshot read path **[GAP-1]**                                                                |
| **Events**        | Select business; open diagnostics                                                                                     |
| **Ownership**     | Filesystem + PostgreSQL                                                                                               |
| **Persistence**   | None                                                                                                                  |
| **Refresh**       | On request                                                                                                            |
| **Relationships** | Entry to S2, S3, S13                                                                                                  |

⚠️ A business with **no** snapshot renders as _"never captured"_ — an honest and expected state, not
an error and not an empty dashboard.

---

## S2 — Businesses

|                   |                                                                            |
| ----------------- | -------------------------------------------------------------------------- |
| **Inputs**        | The client record file                                                     |
| **Outputs**       | `clientId`, `organizationId`, `displayName`, `externalRefs` per record     |
| **Dependencies**  | `loadClientRecordFile`, `parseClientRecord`                                |
| **Events**        | Select a business                                                          |
| **Ownership**     | The operator's filesystem, exclusively                                     |
| **Persistence**   | None. The console never copies records into the repository or the database |
| **Refresh**       | On request; re-read from disk                                              |
| **Relationships** | → S3                                                                       |

🚫 **No create/edit/delete affordance.** The record file is authored by the operator in their editor.
A console that wrote client records would be the first step toward records living in the repo, which
ADR-0053 D3 forbids absolutely.

⚠️ A missing, unreadable, empty or malformed file is a **refusal**, never an empty list. Degrading to
"no records" would make every later lookup report "unknown client" for the wrong reason.

---

## S3 — Business Overview

|                   |                                                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inputs**        | The selected `ClientRecord`; the latest snapshot **[GAP-1]**                                                                                          |
| **Outputs**       | The four scores **rendered separately**; BIF status; populated vs omitted section counts; capture recency; unresolved contradiction count **[GAP-4]** |
| **Dependencies**  | Snapshot read path **[GAP-1]**; `normalizeScoredBifSnapshotRecord`                                                                                    |
| **Events**        | Navigate to any subject                                                                                                                               |
| **Ownership**     | PostgreSQL, via the normalizer                                                                                                                        |
| **Persistence**   | None                                                                                                                                                  |
| **Refresh**       | On request                                                                                                                                            |
| **Relationships** | Hub for S4–S12                                                                                                                                        |

🚫 No composite readiness figure. The four scores appear as four figures with four labels.
⚠️ The demo baseline is **7 populated + 5 omitted** of 12 canonical sections; a real business will
differ, and differing is correct.

---

## S4 — Discovery

|                   |                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Inputs**        | `DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE` (`age-business-discovery` / `2026.1`); the operator's answer file                                                 |
| **Outputs**       | Per-question answer state — **answered / omitted**, never "empty"; validation refusals naming question ids; the produced profile and its scores on a dry run |
| **Dependencies**  | `@age/discovery-answer-file`, `parseDiscoveryAnswerFile`, `produceScoredBifContext`, `@age/operator-file-policy`                                             |
| **Events**        | Load file · edit an answer · omit an answer · validate · dry run · **confirmed capture**                                                                     |
| **Ownership**     | The operator's file                                                                                                                                          |
| **Persistence**   | Writes back to **their** file, outside the working tree                                                                                                      |
| **Refresh**       | On request                                                                                                                                                   |
| **Relationships** | → S5 (the BIF it produces), S11 (the snapshot it appends)                                                                                                    |

⚠️ **Omission is a first-class control**, at least as prominent as answering. The file must never gain
`""` or `[]` — both are refused by name, and a form that submits empty strings by default would
produce exactly the inflated completeness score the refusal exists to prevent.

⚠️ **The path rule has one implementation and the console must call it**, not re-derive it: the file
must be outside the repository root, and relative paths are refused outright rather than resolved,
because `path.resolve` reads `cwd`.

⚠️ **Confirmed capture is the only write on this screen** and carries all five of ADR-0054 D6's
conditions. There is no capture-on-save, no autosave-then-capture, and no scheduling.

---

## S5 — Business Information Framework

|                   |                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Inputs**        | The `ScoredBifContext` projection from a snapshot **[GAP-1]**                                                     |
| **Outputs**       | Per section: populated or **omitted**; per field: value, confidence, provenance, version history, recording actor |
| **Dependencies**  | `@age/bif` section models; the snapshot codec                                                                     |
| **Events**        | Select section; open a field's provenance                                                                         |
| **Ownership**     | PostgreSQL                                                                                                        |
| **Persistence**   | None — **read-only, structurally**                                                                                |
| **Refresh**       | On request                                                                                                        |
| **Relationships** | → S6 per field, → S7, → S11                                                                                       |

🚫 **No edit affordance anywhere on this screen.** The BIF is corrected by capturing a new snapshot
from corrected answers, not by editing a rendered value.

⚠️ **The codec round-trips the `ScoredBifContext` projection, not the live BIF**, and there is
deliberately no context→BIF direction: a BIF carries `Date`s, per-field version history and audit
actors, so reconstructing one would mean inventing that history. **S5 therefore renders a projection
and must label it as one** — it shows what was captured, not a live object.

---

## S6 — Evidence

|                   |                                                                                                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inputs**        | `Evidence`, `ExtractedSignal`, `EvidencePackage` for the business **[GAP-3]**                                                                                                                |
| **Outputs**       | Evidence by `EvidenceSource` and `EvidenceState`; signals by `SignalType` and `Polarity`; `strength` (bounded 0–100); which BIF fields each supports; **fields with no supporting evidence** |
| **Dependencies**  | `@age/evidence-contracts`; an ingestion adapter **[GAP-3]**                                                                                                                                  |
| **Events**        | Filter; open an item; jump to the field it supports                                                                                                                                          |
| **Ownership**     | PostgreSQL once ingestion exists; today, nothing                                                                                                                                             |
| **Persistence**   | None by the console                                                                                                                                                                          |
| **Refresh**       | On request                                                                                                                                                                                   |
| **Relationships** | ← S5, → S7                                                                                                                                                                                   |

🚫 **No `EvidenceSourceClass` facet.** ADR-0056 D1 was rejected; the four proposed classes came from
four different axes and seven of twelve sources admitted more than one. Filter on the concrete twelve
members.
🚫 **No `QUESTION` or `ENGAGEMENT` signal type.** D2 was rejected — `ENGAGEMENT` is a measurement, not
a speech act; `polarity` is required so it would have to invent one; and an unbounded reply count has
no home in a bounded `0–100` `strength`.
⚠️ Honour ADR-0056 **D3**: what a business says about itself and what its numbers show are different
kinds of evidence and are 🚫 never blended into one confidence figure.

**The most valuable thing on this screen is the unsupported-field list**, not the evidence list.

---

## S7 — Contradictions

|                   |                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| **Inputs**        | Detected contradictions; `EvidenceState.CONFLICTED` items **[GAP-4]**                                |
| **Outputs**       | Each contradiction: the two claims, their evidence, their confidences, and whether it is adjudicated |
| **Dependencies**  | `detect-contradictions.ts`; evidence ingestion **[GAP-3]**                                           |
| **Events**        | Open; navigate to either side                                                                        |
| **Ownership**     | Derived                                                                                              |
| **Persistence**   | None. ⚠️ Adjudication would be a write and does not exist **[GAP-5]**                                |
| **Refresh**       | On request                                                                                           |
| **Relationships** | ← S5, S6                                                                                             |

⚠️ **A contradiction is a finding, not a defect.** The screen must not offer "resolve" as a dismissal.
⚠️ Two correct measurements of different things are **not** a contradiction — this was the concrete
failure that sank ADR-0056 D2. Any detector surfaced here must be read with that in mind.

---

## S8 — Intelligence

|                   |                                                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inputs**        | The `ScoredBifContext`; the six capabilities                                                                                                       |
| **Outputs**       | Per capability: did it run, what it produced, its processing summary; separately, context-readiness for Intelligence, Market Discovery and Revenue |
| **Dependencies**  | The six capability packages; `@age/capability-kit`; a runtime caller **[GAP-2]**                                                                   |
| **Events**        | Run a capability against the loaded context; open an item                                                                                          |
| **Ownership**     | Pure computation — no persistence                                                                                                                  |
| **Persistence**   | None. Capability output is **not stored** today                                                                                                    |
| **Refresh**       | On request                                                                                                                                         |
| **Relationships** | ← S5, → S9                                                                                                                                         |

⚠️ **Readiness is a separate named entry point and never a gate on `run`.** The console must not
prevent a run because readiness is low — that would convert a report into a gate, which ADR-0027
forbids.
⚠️ **Check item _content_, never length.** "Ran and produced nothing" and "did not run" are different
claims and render differently.
🚫 **Capability packages must never import `@age/bif`**, and no console convenience may cause that.

---

## S9 — Strategy

|                   |                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| **Inputs**        | Capability outputs; SIE analysis, opportunities, prioritization, recommendations, roadmaps **[GAP-6]** |
| **Outputs**       | Proposals with their basis: which evidence, which BIF fields, which unknowns qualify them              |
| **Dependencies**  | `@age/strategy-intelligence-engine` — present but **unwired to any real business**                     |
| **Events**        | Open a proposal; view its basis                                                                        |
| **Ownership**     | Derived                                                                                                |
| **Persistence**   | None                                                                                                   |
| **Refresh**       | On request                                                                                             |
| **Relationships** | ← S8, → S10                                                                                            |

⚠️ **A proposal that cannot state its basis is not rendered as a proposal.** It is rendered as
unattributed, or not at all.

---

## S10 — Execution

|                   |                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| **Inputs**        | Pending approvals; approval history                                                                         |
| **Outputs**       | What is proposed, what it would affect, what approving it means; who approved what, when                    |
| **Dependencies**  | Execution/approval layer — ⚠️ **demo-only today**; the Phase 5 execution track was **reverted** **[GAP-7]** |
| **Events**        | View. **Approval is 🚫 out of scope for this program**                                                      |
| **Ownership**     | —                                                                                                           |
| **Persistence**   | None                                                                                                        |
| **Refresh**       | On request                                                                                                  |
| **Relationships** | ← S9                                                                                                        |

⚠️ **Read this before designing S10.** PRs #41–#61, `@age/execution-contracts`, the approval workflow
and `@age/platform-context` were **reverted**. The six pending approvals in the demo are scenario
data, not a working approval system. S10 is specified for completeness and 🚫 must not be built from
this document. It is **G-7**, the largest gap in the program.

---

## S11 — History

|                   |                                                                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inputs**        | All snapshots for `(clientId, organizationId, bifId)` **[GAP-1]**                                                                                                 |
| **Outputs**       | Snapshots in capture order, each with its scores and section counts; one snapshot in full; ⚠️ a diff **only if Phase 6 defines comparison semantics** **[GAP-9]** |
| **Dependencies**  | Snapshot read path **[GAP-1]**                                                                                                                                    |
| **Events**        | Select a snapshot; select two for comparison **[GAP-9]**                                                                                                          |
| **Ownership**     | PostgreSQL                                                                                                                                                        |
| **Persistence**   | None — **append-only and immutable**                                                                                                                              |
| **Refresh**       | On request                                                                                                                                                        |
| **Relationships** | ← S3, S5                                                                                                                                                          |

🚫 **No edit, no delete, no "restore", no "set current".** There is no `current` flag, no `version` and
no `deletedAt` in the schema, and the grants are `SELECT, INSERT` only. A restore affordance would be
inventing a data model the database refuses to have.

---

## S12 — Peer Products

|                   |                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Inputs**        | Per peer: contract responses **[GAP-8]**                                                                          |
| **Outputs**       | The four ADR-0053 questions — displayed / requested / received / reasoned about — plus freshness and reachability |
| **Dependencies**  | Peer contract clients — **none exist** **[GAP-8]**                                                                |
| **Events**        | Refresh one peer, on request only                                                                                 |
| **Ownership**     | The peer product                                                                                                  |
| **Persistence**   | None. ⚠️ Caching a peer's response would make AGE a stale second copy of it                                       |
| **Refresh**       | Explicit, per peer, never automatic                                                                               |
| **Relationships** | → S6                                                                                                              |

⚠️ **Must render zero peers honestly** before it renders one. "No peer products connected" and "peer
product unreachable" are different claims.

---

## S13 — Diagnostics

|                   |                                                                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Inputs**        | Listener bind address; database target **host only**; questionnaire id and version; record file path; package versions; the refusal log |
| **Outputs**       | Whether **OX-INV-1** holds; whether the database target is loopback; what the console refused and why                                   |
| **Dependencies**  | `assertLocalDatabaseTarget`; the composition root                                                                                       |
| **Events**        | None. Read-only                                                                                                                         |
| **Ownership**     | Process configuration                                                                                                                   |
| **Persistence**   | None                                                                                                                                    |
| **Refresh**       | On request                                                                                                                              |
| **Relationships** | ← S1                                                                                                                                    |

🚫 **Never renders a connection string, a password, a `DATABASE_URL_APP`, or a stack.** The host, and
nothing else — the same rule `NonLocalDatabaseTargetError` already follows.
⚠️ Diagnostics must state the honest limit in its own words: **loopback is necessary, not sufficient**;
a tunnel or proxy in front of it defeats both checks, and the console 🚫 must never claim otherwise.
