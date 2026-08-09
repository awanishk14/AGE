# ADR-0066 — The hub, and what "two-way" may and may not mean

Status: **D1 and D2 Accepted** (2026-08-09, by the Product Owner — see §0.1 and §0.3).
**D3–D7 remain `Proposed`** — a **decision request**, not a self-acceptance; §7 lists what is still
only the Product Owner's.

Supersedes: nothing. Depends on: ADR-0053 D3/D5, ADR-0054 D7, ADR-0057 D4 + OX-INV-1,
ADR-0059 D3/D4.2/D4.3/D5, ADR-0061 §5, ADR-0062 D1–D3.

---

## 0.1 The Product Owner's answer to §7 Q2, verbatim

> _"i want it only read back"_
>
> — the Product Owner, 2026-08-09, answering **§7 Q2** ("read-back or write-back?").

**This accepts D1 and nothing else.** ⚠️ It is not an acceptance of D2–D7, and 🚫 it does not
answer §7 Q1 (which product is hosted — ADR-0061 §5), Q3 (plain text only, or PDFs) or Q4 (a
second operator, or the business owner). Those three remain open and remain the owner's.

**What D1 now forbids, as an accepted decision:**

- 🛑 **AGE has NO outbound write surface to any external system.** No slice may add one — not a
  CRM update, not an ad change, not a calendar write, not a "sync back", and 🚫 not a
  "preview" or "dry run" of one (still class 3 under ADR-0057 D4).
- 🚫 **"Two-way" is never to be re-read as write-back** by a later slice, document or council.
  Reopening it needs a fresh `Proposed` ADR carrying its own authorization model and its own
  liability answer — 🚫 it is not a residual and not a to-do.
- ⚠️ Tools benefit from one another **through AGE's read surface only**. Every tool pulls the
  unified picture; 🚫 no tool is pushed to.

## 0.2 The Product Owner's answers to §7 Q1, Q3 and Q4 (2026-08-09)

> _"lets go with your recommendation and post client meeting i will confirm on business owner
> thing"_
>
> — the Product Owner, 2026-08-09, after being shown all three questions with their options and
> costs. Earlier in the same exchange: _"we had also planned a demo frontend to be hosted to show
> client"_ — the fact that decided Q1.

The recommendation accepted was, verbatim in substance:

**Q1 — ANSWERED. Host `apps/web` + `apps/api`, the read-only demo.** 🛑 Not Studio. Recorded as the
answer to **ADR-0061 §5**, where it now lives in full (§5-A to §5-D). ⚠️ The consequence most
easily lost: **the hosted demo shows a fictional business, never a prospect's own**, and 🚫 must
not grow a login or an input by which a visitor supplies a company.

**Q3 — ANSWERED. Plain text first; the PDF/DOCX decoder is the NEXT slice, not this one.**
⚠️ Ordering rationale, on the record: text-only proves the provenance chain with nothing to blame
but our own code. 🚫 ADR-0059 D4.2 is **not** thereby discharged — the decoder still needs its own
ADR naming the library.

**Q4 — DEFERRED BY THE OWNER, and 🛑 deferred is not answered.** The build proceeds on **"a second
operator"**. 🚫 No slice may assume, prepare for, or half-build a **business-owner login** — that
would answer Q4 in code, and ADR-0062 D2 makes a client a _subject_ of isolation, **recorded, not
authorized**. ⚠️ The owner will confirm after a client meeting; 🚫 do not treat silence as
"operator, settled" and 🚫 do not treat the plan as permission to start it.

## 0.3 The Product Owner's acceptance of D2, verbatim (2026-08-09)

> _"I accept D2._
>
> _The architectural principle is: provenance is metadata about origin, not evidence of truth and
> not a scoring input._
>
> _A document saying something does not, by itself, make that statement more trustworthy than the
> same statement supplied directly by the client. Therefore provenance must travel on a separate
> channel and must not influence scoring, BIF reasoning, confidence, or any other semantic result._
>
> _I specifically accept the proposed invariant that identical profile facts with different
> provenance must produce byte-identical scores/results. Please make that a hard regression guard._
>
> _One wording change: don't say "documents will never make a score go up." Say "provenance alone
> never changes a score." A future ADR may define how actual source content can become evidence,
> but that would be a separate reasoning/evidence decision and must never happen implicitly because
> a provenance record exists._
>
> _Proceed with D2 on that basis."_
>
> — the Product Owner, 2026-08-09, answering **§7 Q5** (D2).

**This accepts D2 and nothing else.** ⚠️ 🚫 It does not accept D3–D7, and 🚫 it does not answer §7
Q4 (still deferred).

### 0.3a ⚠️ THE WORDING CORRECTION IS BINDING, AND THE OLD PHRASING IS WRONG

🚫 **Never write, in an ADR, a comment, a UI string or a handover: _"a document can never raise a
score."_** That is **too broad** and would pre-empt a decision the Product Owner has deliberately
left open. ✅ **The correct sentence, and the only one to use, is:**

> **Provenance alone never changes a score.**

⚠️ The difference is the whole point. **Provenance is a record that a claim came from somewhere.**
It is not a reading of what that somewhere _says_. A future ADR may decide that the **content** of
a source constitutes **evidence** for or against a claim — that is a legitimate, separate
reasoning/evidence decision, and 🛑 it must be taken **explicitly, in its own ADR**. 🚫 It must
never happen **implicitly, as a side effect of a provenance record existing**.

### 0.3b The four layers, and the direction they run

The Product Owner named the separation this decision protects. **It is one direction only:**

```
PROVENANCE   where did this claim originate?
     ↓
EVIDENCE     what supports or contradicts this claim?
     ↓
REASONING    what should AGE conclude?
     ↓
SCORE        what does the current model calculate?
```

🚫 **A layer never reaches back up.** 🚫 `SOURCE ≠ EVIDENCE ≠ CONFIDENCE`, and collapsing any two of
them into one is the failure this ADR exists to prevent. ⚠️ Two consequences that are easy to lose:

- 🚫 **A client-typed answer is NOT less trustworthy for having no document behind it.** The
  asymmetry runs both ways: extraction does not promote, and typing does not demote.
- ⚠️ The value bought is **temporal**: richer provenance can be added later **without silently
  changing the meaning of scores already recorded**. A score from last month must still mean what
  it meant last month.

### 0.3c The invariant is a HARD REGRESSION GUARD, not a test that happens to exist

At the owner's explicit instruction, D2's invariant is promoted from "a test asserts" to a
**standing architectural invariant**, on the same footing as ADR-0057 OX-INV-1:

> **AGE-INV-PROV-1 — Identical profile facts with different provenance MUST produce byte-identical
> scoring and BIF results.**

🚫 It is not an implementation detail of one slice and 🚫 must not be relaxed, narrowed to a subset
of fields, or deleted when a later slice finds it inconvenient. ⚠️ Per the project's own rule, it is
evidence **only once it has been made to fail** — the slice that lands it must mutate the channel so
a score moves, show the guard naming that, and restore.

### 0.3d 🚫 What §0.3 does NOT authorize

The Product Owner's note also set out a longer direction — a fact's full journey
(`Client → Source → Claim → Evidence → Reasoning → Result`, and later
`Claim → Strategy → Action → Outcome → Feedback`), and the position that AGE's relationships are a
**semantic graph** that 🚫 does **not** justify adopting a graph database (Neo4j) before a real
workload demonstrates a relational/document model cannot serve it — _"don't optimize the storage
engine before you've discovered the actual query patterns."_

⚠️ **That is recorded as direction and as a standing constraint on storage choices. 🚫 It is NOT an
authorization.** 🚫 No slice may build an evidence layer, a reasoning layer, a strategy/action/
outcome loop, or a new store from these lines. Each needs its own `Proposed` ADR. 🛑 In particular,
**introducing a graph database is refused by default** and would need an ADR carrying the
demonstrated workload that requires it.

---

## 1. The goal, restated in the owner's words and then corrected

The Product Owner's statement: _"we want all disconnected tools to pass info to AGE for getting
uniformed information to make decision. AGE has multiple apps communicating to it and it has to be
2-way communication so all other tools benefit from each other."_

**Three of the four clauses are already the architecture.** AGE is a hub; many sources feed one
unified picture; other tools read that picture back. `produceScoredBifContext` is the single
Discovery→BIF mapping, `@age/operator-workspace` is the single orchestration, and `apps/mcp`
already serves eleven tools over that same implementation to any MCP client. **An external tool
reading the unified picture back out is shipped and working today.**

**One clause needs correcting, and it is the load-bearing one.** "Two-way, so all other tools
benefit from each other" reads naturally as _AGE writes back into the source tools, and the tools
sync with one another_. That is a **different and much larger** system than the one being built,
and adopting it silently would repeal ADR-0057 D4 (class 3 — AGE never acts on a business's
behalf). This ADR therefore distinguishes:

- **Two-way as READ-BACK** — a tool pushes facts in; any tool may pull the unified picture out,
  whole, with each claim's origin attached. Every tool benefits from every other tool's
  contribution _through AGE_, without AGE touching any of them. ✅ This is the goal, and it is
  most of the way built.
- **Two-way as WRITE-BACK** — AGE pushes changes into a source tool (updates a CRM record, posts
  an ad change). 🛑 **Refused here**, class 3 under ADR-0057 D4. It needs its own ADR, its own
  authorization model, and a Product Owner decision about liability.

**D1. "Two-way" means read-back, not write-back. AGE is a hub with an inbound and an outbound
read surface, and no outbound _write_ surface to any external system.**

---

## 2. What actually exists today (audited, `main` @ `6eece6d`)

| Clause of the goal                    | State                                                                                                                                                                      |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A single unified picture              | ✅ `produceScoredBifContext` — one mapping, no second path                                                                                                                 |
| Many sources feed it                  | ❌ **One** source: a human typing into the questionnaire                                                                                                                   |
| Other tools read it back              | ✅ `apps/mcp` — 11 tools, stdio JSON-RPC, same implementation                                                                                                              |
| Each claim carries its origin         | ⚠️ **The type exists and nothing reads it** (see D2)                                                                                                                       |
| Tools push info _in_ over a network   | ❌ **No ingest endpoint exists.** `apps/api` has exactly two live routes (`GET /health`, `GET /demo/capabilities`); all 21 domain controllers carry no HTTP verb decorator |
| Anyone but the developer can reach it | ❌ Studio is loopback-pinned by construction; `deploy/vps/` has no app service                                                                                             |
| Authorization                         | ❌ `askEntitlement(` has **zero callers**, proven by a repo-wide guard. Ten auth/tenancy/audit packages have zero application importers                                    |

**Plain answer to "are we ready": the hub is real, the read-back is real, and there is exactly one
source feeding it. We are not ready, and the missing piece is not the network — it is that the
picture cannot yet say where a claim came from.**

---

## 3. The finding that reorders everything

`@age/assisted-intake` (#269) produces answers stamped `confirmed-from-source`. It has **zero
importers**. Wiring it is tempting and would be wrong today, because:

1. `build-profile-from-answers.ts` contains **no occurrence of the token `provenance`**. A
   `confirmed-from-source` answer and a typed answer produce an **identical** profile.
2. The canonical Answer File **structurally cannot hold** a second source:
   `parse-discovery-answer-file.ts:278` hard-codes `STATED_ANSWER_PROVENANCE`, deliberately, and
   says an extraction surface must hand its candidates to _something else_ — and nobody has
   decided what that something else is.
3. **`fieldEvidence` is not an inert carrier.** It is read at `completeness-scoring.ts:318` and
   `:619` (evidenced sections escape `uncitedEvidenceCap`) and at
   `business-discovery-to-bif.ts:396-398, 429` (it decides each field's `FieldSource`). Populating
   it to carry provenance would **move the pinned 98/63 vs 12/17 baseline** (ADR-0054 D7) and
   would convert "a document said it" into "we are more confident" — refused by ADR-0059 D3.

**D2. Answer provenance travels on a channel the scorers cannot see.** ✅ **Accepted 2026-08-09 —
see §0.3.** It is carried alongside the profile, never inside `fieldEvidence` and never inside
`evidenceSources`. **AGE-INV-PROV-1** (§0.3c) is the hard guard: a profile built from a mixed
stated/confirmed answer set yields **byte-identical** scoring and BIF results to one built from the
same answers all marked `stated`.

⚠️ **The accepted principle, in the owner's words: _provenance is metadata about origin, not
evidence of truth and not a scoring input._** It must not influence scoring, BIF reasoning,
confidence, **or any other semantic result**. 🚫 The rule is **not** "a document can never raise a
score" — see §0.3a for why that phrasing is wrong and what to say instead.

**D3. A source that cannot be named is not a source.** An answer whose provenance is
`confirmed-from-source` must carry its `sourceId`, `locator` and `confirmedBy`, or it is refused —
🚫 never defaulted to `stated`. Losing provenance silently is worse than refusing the answer,
because it launders a document's words into "what the business said".

**D4. The durable home for a confirmed answer is the DRAFT, extended — not the Answer File.** The
Answer File stays `stated`-only and byte-identical; its parser keeps its hard-coded provenance.

---

## 4. What a second source may not do

**D5. Ingest never promotes.** A pushed fact enters as an answer candidate an operator confirms.
🚫 No source writes a BIF, no source moves a status, no source produces a score. ADR-0059's
"the extractor proposes passages, not answers" generalises to every future source.

**D6. Every inbound surface names its source, and an unknown source is refused** — 🚫 never
recorded as "unknown" and never attributed to the operator.

**D7. `askEntitlement` is called before any inbound surface accepts a byte.** Today it has no
caller by design. The first inbound network endpoint is the slice that must give it one — 🚫 an
ingest endpoint shipped before that call is an unauthenticated write to a client's record.

---

## 5. The proposed order (each its own slice, each its own PR)

| #   | Slice                                                               | Why here                                                                                            |
| --- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | **This ADR** accepted                                               | Nothing below is authorized without it                                                              |
| 2   | The mapper carries provenance on the D2 channel                     | The only true blocker; nothing else needs building twice                                            |
| 3   | The draft learns provenance; Answer File output byte-identical      | D4                                                                                                  |
| 4   | Wire `@age/assisted-intake` + a Studio **Sources** screen           | Second source becomes real; discharges the standing "a backend capability needs a Studio home" rule |
| 5   | BIF panel shows, per field, which source it came from               | 🚫 Two labels, never merged (ADR-0064)                                                              |
| 6   | Two MCP tools expose the multi-source picture, serialised **whole** | The read-back clause, now honestly multi-source                                                     |

**After slice 6 the goal is demonstrable end to end on one machine, with zero deployment and zero
reversal of any shipped decision.**

⚠️ **Slice 1 is discharged for D1 and D2 only** (§0.1, §0.3). 🚫 Slices 3–6 stay unauthorized until
D3–D7 are accepted; slice **2** is authorized now.

The deployed app service shipped in #281 (§0.2). Everything else network-facing — the **ingest
endpoint**, login, the session store rows — still sits behind D7 and behind §7 Q4, and 🚫 an ingest
endpoint before `askEntitlement` has a caller is an unauthenticated write to a client's record.

---

## 6. Dissent recorded

A council of four lenses ran on the code (not on my prose). The sequencing lens recommended
carrying provenance **in `fieldEvidence`**, naming as its own highest-risk assumption that
"provenance is inert", and proposed a 15-minute falsification. **The experiment was run and the
assumption is false** — the two call sites in §3 item 3. Its evidence is adopted; its
implementation conclusion is rejected and replaced by D2. The security lens leaned in places on my
own handover prose rather than the code; its ADR-status claims were re-verified directly before
use. The audit lens could not determine whether any real snapshot row exists in a live database —
that is runtime state outside the repo and remains unverified here.

---

## 7. 🛑 Questions only the Product Owner may answer

1. **ADR-0061 §5 — which product is hosted?** ✅ **ANSWERED 2026-08-09 (§0.2)** — the read-only
   demo (`apps/web` + `apps/api`), 🛑 **not** Studio. Recorded in full at ADR-0061 §5-A to §5-D.
2. **Does "all other tools benefit from each other" mean read-back (D1) or write-back?**
   ✅ **ANSWERED — read-back (§0.1).** 🛑 D1 accepted; write-back is refused.
3. **Is a plain-text-only pilot acceptable?** ✅ **ANSWERED — yes, plain text first (§0.2).**
   🚫 ADR-0059 D4.2 is **not** thereby discharged; the decoder still needs its own ADR.
4. **Does "a real human other than the developer" mean a second operator, or the business owner?**
   ADR-0062 D2 makes a client a _subject_ of isolation, recorded but not authorized. The answer
   changes slice 7 entirely. 🛑 **DEFERRED by the owner pending a client meeting** (§0.2) —
   🚫 deferred is not answered.
5. **Is D2 the right channel for provenance?** ✅ **ANSWERED — accepted 2026-08-09 (§0.3)**, with a
   binding wording correction (§0.3a) and the invariant promoted to **AGE-INV-PROV-1** (§0.3c).

⚠️ **Q1, Q2, Q3 and Q5 are answered. Q4 is deferred. D3–D7 are still `Proposed`** — 🚫 slices 3–6
are not authorized by this ADR's acceptance of D2.
