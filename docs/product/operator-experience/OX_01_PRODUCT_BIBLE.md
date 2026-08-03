# Phase 1 — The Operator Experience Product Bible

> The source of truth for how a human works with AGE from first onboarding to continuous operation.
> **Status: Proposed.** Governed by ADR-0057. Read [`OX_00_README.md`](./OX_00_README.md) first —
> particularly the reconciliation with `07_UI_NAVIGATION.md` and **OX-INV-1**.

---

## 1. The operator, and what they are actually doing

There is exactly one persona in this program. Not because AGE will only ever have one, but because
the trust model has exactly one.

**The Operator.** Runs AGE on their own machine. Owns the client records. Owns the database. Is
trusted absolutely, because there is no mechanism by which they could be trusted otherwise. They are
the same principal that today types `age-capture onboard`.

Their job is not "using a CRM". It is **deciding whether to believe AGE**, repeatedly, about a real
business. Every screen in this program serves that one act. The operator's recurring questions are:

| Question                                 | Where it is answered             |
| ---------------------------------------- | -------------------------------- |
| What does AGE think about this business? | BIF                              |
| Why does it think that?                  | Evidence → Provenance            |
| How sure is it?                          | Confidence, per field            |
| What does it not know?                   | Unknowns, omissions, limitations |
| What does it disagree with itself about? | Contradictions                   |
| What does it want to do?                 | Strategy → Execution             |
| What did it think last week?             | Snapshots → History              |
| What are the other products saying?      | Peer Products                    |

**A screen that does not answer one of those eight questions does not belong in this program.**

---

## 2. The lifecycle

Eight stages. The operator moves through 1–4 once per business, then lives in 5–8 continuously.

### Stage 1 — Onboarding a business

The operator establishes that a business exists to AGE. Concretely: a `ClientRecord` — `clientId`,
`organizationId`, `displayName`, and an open `externalRefs` map to whatever the business is called in
Meta, GA4, or any peer product. **The record is the identity and nothing more:** no lifecycle, no
status, no business attributes. Anything a capability would reason over belongs in the BIF.

⚠️ Records live in a file **outside the working tree** and are **never committed** (ADR-0053 D3), not
even redacted. The console reads them; it does not relocate them into the repository.

### Stage 2 — Discovery

The operator answers the questionnaire (`age-business-discovery`, version `2026.1`) on behalf of the
business: 15 questions across 10 sections, from `bi-name` to `ev-assumptions`. Some are single
strings, most are lists.

The governing rule is **omission**: an unanswered question is absent from the file entirely. Not
`""`, not `[]`. Both are refused by name, precisely because a recorded empty answer would inflate the
completeness score of a profile that is missing data. **The console must make omitting easier than
faking**, which is the inverse of what a normal form does.

### Stage 3 — Profile and BIF production

Answers become a `BusinessDiscoveryProfile`, and the profile becomes a scored `ScoredBifContext`
through `produceScoredBifContext` — the **only** Discovery→BIF mapping in the repository.

The mapper **transcribes and never infers**. It will not guess whether something is a product or a
service, will not split one prose answer into several entries, and will not default a type. Where the
operator was vague, the BIF is vague. The console's job is to make that visible rather than to smooth
it over.

Four scores come out, and **they are never combined**:

| Score                        | Means                                  |
| ---------------------------- | -------------------------------------- |
| `discoveryCompletenessScore` | how completely the intake was captured |
| `discoveryConfidenceScore`   | confidence in the intake               |
| `bif.completenessScore`      | how completely the BIF is populated    |
| BIF confidence               | confidence in the BIF                  |

🚫 Discovery completeness and BIF completeness are **not interchangeable** and must never be shown in
a way that suggests they are — no shared axis, no single "readiness %", no average.

### Stage 4 — Capture

The scored context is written as an **immutable, append-only snapshot** keyed
`(clientId, organizationId, bifId, snapshotId)`. No update, no delete, no upsert, anywhere in the
system. There is no "current" flag and no version column: the history _is_ the rows.

This is currently permitted only under ADR-0054 D6's five conditions — local database, scope from a
loaded record, explicit `--capture --confirm`, no background execution.

### Stage 5 — Reading back

The operator reads the stored projection. **This is the stage that does not exist yet** and is the
first thing the console should make real (ADR-0055, `inspect`).

⚠️ Stored rows are **untrusted input** and are re-validated on read (`normalizeScoredBifSnapshotRecord`).
The console renders the normalized result, never the raw row.

### Stage 6 — Intelligence review

Six capabilities run against the context and produce items, plan items, and readiness assessments.
Three of them (Intelligence, Market Discovery, Revenue) expose a **separate** context-readiness entry
point — deliberately not a gate on `run`.

⚠️ **`output.items` is not permanently empty.** A screen must check item _content_, never length, and
must render "ran, produced nothing" differently from "did not run".

### Stage 7 — Strategy and execution

Strategy is proposed; execution is **approved, never automatic**. Today six pending approvals exist in
the demo and nothing else. The accounting invariant that guards the demo must hold on any real
surface too.

### Stage 8 — Continuous operation

New evidence arrives, contradicts or reinforces the BIF, and the operator adjudicates. `EvidenceState`
already models the whole path: `NEW → PROCESSED → MAPPED → APPLIED_TO_BIF`, with `REJECTED` and
`CONFLICTED` as terminal judgements. **`CONFLICTED` is the interesting state** and deserves a
first-class surface — it is AGE admitting it disagrees with itself.

---

## 3. Information architecture

Three levels, and only three.

```
Console  →  Business  →  Subject
```

- **Console** — the machine. Which businesses exist, what changed, what is waiting.
- **Business** — one `ClientRecord` and everything scoped to it. This is where the operator lives.
- **Subject** — one lens on that business: Discovery, BIF, Evidence, Intelligence, Strategy,
  Execution, Peer Products, History.

⚠️ There is **no Project level**. Doc 07 defines `Organization → Client → Project`; Projects have no
representation anywhere in the current architecture, and inventing one would violate the program's
first principle. When Projects become real, this collapses back toward Doc 07's model.

**Engines are never navigation.** BIF, BKG, RIE, SIE, repositories, orchestrators — the operator never
sees these words as places. They appear only where naming the producer of a value _is_ the provenance.

---

## 4. Screen inventory

Twelve screens. Each states its one job; Phase 3 defines its data contract and Phase 4 proves it maps
to something real.

| #   | Screen                         | Its one job                                                              | Level    |
| --- | ------------------------------ | ------------------------------------------------------------------------ | -------- |
| S1  | Console Home                   | What changed, what is waiting, what is broken                            | Console  |
| S2  | Businesses                     | Which businesses AGE knows, and their identity mappings                  | Console  |
| S3  | Business Overview              | The state of one business at a glance, with its four scores kept apart   | Business |
| S4  | Discovery                      | Author, validate and diff the answer set                                 | Subject  |
| S5  | Business Information Framework | What AGE believes, section by section, with omissions shown as omissions | Subject  |
| S6  | Evidence                       | What supports each belief, and what is unsupported                       | Subject  |
| S7  | Contradictions                 | Where AGE disagrees with itself                                          | Subject  |
| S8  | Intelligence                   | What the six capabilities produced, and their readiness                  | Subject  |
| S9  | Strategy                       | What AGE proposes and on what basis                                      | Subject  |
| S10 | Execution                      | What awaits approval; what was approved and by whom                      | Subject  |
| S11 | History                        | Snapshots over time, and what changed between two of them                | Subject  |
| S12 | Peer Products                  | What each peer product reports, and what AGE did with it                 | Subject  |
| S13 | Diagnostics                    | Whether the console is telling the truth about itself                    | Console  |

S13 is not a settings page. It is where the console proves its own claims: which database it is bound
to, that the listener is loopback, which questionnaire version is active, which snapshot is being
read, and what the console refused and why. **A console that cannot be audited is not a window; it is
a second opinion.**

---

## 5. Actions, and their permission classes

The class is a property of the action, not of the operator. ⚠️ **There were four; there is now one.**

⚠️ **REWRITTEN 2026-08-03 by ADR-0057 §0.7 — read D4 there, which is canonical.** This table twice
said the wrong thing (first two write classes, then none); it now mirrors the owner's own categories.

| Class                           | Meaning                                                                                                | V1                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------- |
| **Read**                        | No effect                                                                                              | ✅                         |
| **1 · Platform Administration** | Create organization · invite members · create client · configure integrations                          | ✅ allowed                 |
| **2 · Knowledge Authoring**     | Discovery questionnaire · generate BIF · manual notes · attach evidence                                | ✅ allowed                 |
| **3 · Business Execution**      | RankOps · MCP Ads · publish · campaigns · **anything external**, and **anything AGE initiates itself** | 🚫 **REFUSED**             |
| **Refused**                     | Structurally unavailable in the console                                                                | Everything in §6 + class 3 |

**The invariant, verbatim:** _"Human-authored knowledge is permitted. System-initiated execution
remains prohibited until the execution layer is enabled."_

🚫 **What an allowed class does NOT license:** 🛑 an invitation that grants access (there is no
identity — ADR-0057 §0.7 note 1) · 🛑 storing a credential (no secret store — note 2) · 🛑 capture
outside ADR-0054 D6's five conditions · 🛑 reading a real snapshot before ADR-0055 D7 · 🚫 anything
autosaved, scheduled, backgrounded or recomputed on AGE's own initiative, **however internal its
effect** — that is class 3 by the _who initiates_ test. 🚫 "The operator confirmed it" is not a
substitute for the 🛑 **ADR L** that class 3 requires.

### What is immutable

Snapshots. Absolutely and structurally — `GRANT SELECT, INSERT` only. **No screen offers an edit
affordance on a snapshot**, and none offers a delete. A correction is a _new_ snapshot, and the
history shows both. This is not a UI convention that could be relaxed; the grants make it true.

Also immutable to the console: BIF field provenance and audit actors, the questionnaire, and any
score.

### What is editable

Only two things, and both live outside AGE's data: the **answer file** and the **client record file**.
Both are the operator's own files, in their own directory, and the console edits them as files.

---

## 6. Categorical refusals

The console does not do these, and no configuration enables them:

- 🚫 Authenticate anyone, or model a second user. There is no login and no account.
- 🚫 Bind to anything but loopback (**OX-INV-1**).
- 🚫 Promote a BIF from `Draft` to `Active`.
- 🚫 Placeholder-fill an omitted section, or render an omission as a zero.
- 🚫 Improve, recompute, override or cap any score.
- 🚫 Convert unknown into good or bad. Insufficient context is a **successful** outcome and is
  rendered as one.
- 🚫 Edit, delete or version a snapshot.
- 🚫 Write to a peer product, or render a peer product's UI.
- 🚫 Fabricate provenance, sections, scores or conclusions.
- 🚫 Run anything on a schedule, in the background, or on a timer.
- 🚫 Default a `clientId`, an `organizationId` or an `OperatorPrincipal`. Ever, anywhere.

---

## 7. How intelligence is surfaced

The program's central design rule:

> **Every claim renders with its support, and every absence renders as an absence.**

Concretely, a rendered claim carries five things. Where one is missing, the screen says so rather
than omitting the row:

1. **The value** — what AGE believes.
2. **Confidence** — how sure, never merged with completeness.
3. **Provenance** — which answer, document, statement or peer product produced it, and which actor
   recorded it.
4. **Contradiction status** — whether other evidence disputes it.
5. **Recency** — which snapshot it came from.

An unsupported value is shown **as unsupported**, not hidden. Hiding it would let AGE make an
unattributed claim, which is the failure this whole program exists to prevent.

### Evidence vocabulary — read this before designing any evidence filter

⚠️ **ADR-0056 D1 and D2 were REJECTED.** There is **no** `EvidenceSourceClass`, and there are **no**
`QUESTION` or `ENGAGEMENT` signal types. The council found `EvidenceSource`'s twelve members are drawn
from four different axes, so no single-axis classification is clean over them, and seven of twelve
admit more than one class.

**Consequence for the console: do not build a source-class facet.** Filter on the concrete
`EvidenceSource` members that exist. If a grouping is genuinely wanted later, it belongs as a field on
the `Evidence` record set by the fetching adapter — and no adapter exists yet.

What does stand from ADR-0056 is **D3, the discovery-versus-performance boundary**: what a business
_says about itself_ and what its _numbers show_ are different kinds of evidence and must not be
blended into one confidence figure.

---

## 8. Peer products

Per ADR-0053 and `11_INTEGRATION_CATALOG.md` §2.1, a peer product is an independent product the same
organization owns, reached **through its public contract only**. RankOps, MCP Ads Server, SNARA,
Humantik, WhatsApp.

Four questions, answered per peer product on S12, and nothing else:

|                            |                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| **What AGE displays**      | The peer's reported facts, attributed to it by name, never restyled as AGE's own conclusion |
| **What AGE requests**      | The specific contract call, shown so the operator can see what was asked                    |
| **What AGE receives**      | The response, and whether it was fresh, stale or unavailable                                |
| **What AGE reasons about** | Which BIF fields or signals it influenced, and how                                          |

**The dependency arrow points from AGE outward and never back.** AGE absorbs the translation; the peer
product changes nothing for AGE's benefit. 🚫 The console never renders a peer's interface, never
proxies a write to it, and never presents its data as indistinguishable from AGE's own.

⚠️ **Dissent 3 is deliberately open:** RankOps is unfinished, so mcp-ads may be the right first
integration. S12 must therefore be built to show _zero_ peer products honestly before it shows one.

---

## 9. What belongs inside AGE, and what does not

| Inside AGE                                       | Inside the peer product               |
| ------------------------------------------------ | ------------------------------------- |
| The business's identity mapping (`externalRefs`) | The business's account in that system |
| Interpretation of peer signals in business terms | The signal's own domain semantics     |
| Cross-product contradictions                     | Intra-product correctness             |
| Strategy spanning products                       | Execution inside one product          |
| The BIF                                          | Any product-specific model            |

The test: _if the peer product vanished, would this still be a fact about the business?_ If yes, AGE
holds it. If no, AGE holds only the reference.

---

## 10. Open product questions — owner decisions, not architect decisions

These are stops, listed here and carried into Phase 6.

1. ✅ **ANSWERED 2026-08-03, then CLARIFIED the same day — ⚠️ the answer is the THREE ACTION CLASSES
   of ADR-0057 D4, not "read-only", which is 🚫 RETIRED as ambiguous.** ✅ Platform Administration and
   ✅ Knowledge Authoring are allowed in V1; 🚫 **Business Execution is refused.** The invariant,
   verbatim: **"Human-authored knowledge is permitted. System-initiated execution remains prohibited
   until the execution layer is enabled."** ⚠️ The original reasoning still binds — _"the UI should
   first prove that it can accurately represent AGE's thinking. Only then should it become an action
   surface"_ — and it is **class 3** that stays shut. 🛑 Opening it needs **ADR L**.
2. 🛑 **REOPENED by the clarification — it was moot only while the console could not write.** Now that
   Knowledge Authoring is allowed, the answer file and the console are **two authors of the same
   knowledge**. ⚠️ This must be answered **before Discovery's submit is enabled** (ADR-0057 §6 q4),
   or AGE acquires a second, invisible source of truth. 🚫 An allowed action class is not an answer.
3. **Does History diff two snapshots, or only list them?** Diffing implies a comparison semantics
   nothing in the repository currently defines.
4. **What does the console do when zero peer products are reachable?** Showing nothing and showing
   "unreachable" are different claims, and only one of them is honest.
