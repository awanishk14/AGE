# ADR-0066 — The hub, and what "two-way" may and may not mean

Status: **ACCEPTED IN FULL — D1–D7** (D1/D2 2026-08-09, D3 2026-08-10, **D4–D7 2026-08-10** — all
seven by the Product Owner, 🚫 none self-accepted; see §0.1, §0.3, §0.4 and **§0.5**).
⚠️ **D4, D6 and D7 are accepted WITH BINDING CLARIFICATIONS** (§0.5a, §0.5c, §0.5d) — a
clarification is part of the decision, 🚫 not commentary on it. ✅ **§7 Q4 IS ANSWERED
(2026-08-10, §0.6) — a SECOND OPERATOR**, and 🚫 the durable-storage mechanism for the draft is a
**separate decision** (§0.5a).

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

## 0.4 The Product Owner's acceptance of D3, verbatim (2026-08-10)

> _I accept D3 as written._
>
> _A confirmed-from-source answer must contain all three provenance components: sourceId, locator,
> and confirmedBy. If any is missing, AGE must refuse the answer._
>
> _Do not downgrade it to stated, because that changes the historical meaning of how the fact
> entered AGE. Do not invent or infer missing provenance._
>
> _I agree that we should not create an exception now. If a future source type genuinely has a
> different notion of location — such as an interview transcript timestamp or a scanned document
> without conventional page numbers — that source type can define its own valid locator semantics
> through a separate decision._
>
> _One wording refinement for the ADR: the principle is not that the underlying source "is not a
> source"; it is that AGE cannot accept a source-confirmed answer when its provenance is
> incomplete._
>
> _D3 is therefore accepted in principle. Proceed with the slice 3 implementation under this rule._

— the Product Owner, 2026-08-10.

**This accepts D3 and nothing else.** ⚠️ 🚫 It does not accept D4–D7, and 🚫 it does not answer §7
Q4 (still deferred). 🚫 Slices 4–6 remain unauthorized.

⚠️ **ONE SCOPE CORRECTION THE ARCHITECT OWES, AGAINST HIS OWN EARLIER FRAMING.** The owner's closing
line — _"proceed with the slice 3 implementation under this rule"_ — accepts **the rule**, and the
rule is D3's. But the slice tabled at §5 row 3 (_"the draft learns provenance"_) is authorized by
**D4**, not D3, and 🛑 **D4 is still `Proposed`**. The architect had told the owner that accepting
D3 unblocked slice 3; that was **wrong**, and it is corrected here rather than built on. ✅ What D3
authorizes by itself is the **completeness rule enforced where answers enter** — see §5. 🚫 The
draft does not grow a provenance store until D4 is accepted.

### 0.4a ⚠️ THE WORDING REFINEMENT IS BINDING — D3's OLD HEADING IS WRONG

🚫 **Never write _"a source that cannot be named is not a source."_** That phrasing makes a claim
about **the world** — that the document, the phone call, the scan does not exist. AGE is in no
position to say that, and saying it would make the rule read as a judgement about legitimacy rather
than about representability. ✅ **The correct principle, and the only one to state, is:**

> **A source-confirmed answer is valid only when its provenance is complete enough to identify the
> source, locate the originating material, and identify the confirmer.**

⚠️ The distinction matters for how this evolves. The failure is **AGE's inability to represent the
provenance completely**, 🚫 not the source's non-existence. A future source type may therefore
define **its own valid `locator` semantics** — `transcript:00:14:32` for an interview,
`image:page-7` for a scan — and still satisfy D3 in full. 🛑 That is a **separate decision**, in its
own ADR; 🚫 it is not an exception to D3 and 🚫 no slice may invent a locator format from these
lines. **Every source type must define what "locatable" means for it** before it is accepted.

### 0.4b The three fields answer three different audit questions

In the owner's words — 🚫 losing any one is not a partial record, it is a **materially different**
claim:

| Field         | The question it answers              | What its absence destroys                                          |
| ------------- | ------------------------------------ | ------------------------------------------------------------------ |
| `sourceId`    | **Which** source?                    | _"page 4"_ of **what**? The locator points nowhere.                |
| `locator`     | **Where** in that source?            | AGE cannot take the operator back to the originating statement.    |
| `confirmedBy` | **Who** established this provenance? | No one is accountable for the judgement that the source says this. |

### 0.4c 🚫 THE DOWNGRADE IS THE THING BEING REFUSED

⚠️ **This is the most important part of D3**, in the owner's framing. These two are **not**
equivalent and must never be silently exchanged:

- `stated` — _"Client told AGE X."_
- `confirmed-from-source` — _"Operator found X in source Y at location Z."_

🚫 **If the second becomes the first because metadata is missing, AGE has changed the history of how
the fact entered the system** — and nothing downstream can detect it. That is strictly worse than
refusing. The refusal AGE owes the operator is: _"You told me this is a source-confirmed fact, but
you haven't supplied enough information for me to record that claim honestly."_

### 0.4d D2 + D3 together — the epistemic discipline, in the owner's words

- **D2:** provenance must **not** affect truth or scoring.
- **D3:** provenance must be **complete** if AGE claims it exists.

> _AGE neither trusts a source merely because it exists, nor pretends provenance exists when it
> cannot prove it._

⚠️ The generalisation the owner drew, and the sentence to carry forward: **if AGE claims a fact has
a particular provenance, AGE must be able to prove that provenance — otherwise it must refuse the
claim.**

---

## 0.5 The Product Owner's acceptance of D4, D5, D6 and D7, verbatim (2026-08-10)

> _"I agree with the overall direction, but I would not accept all four blindly as written. D5, D6,
> and D7 are strong architectural fences. D4 is the one I would accept with a clarification, because
> 'draft becomes durable' is a significant architectural change and we should make sure provenance
> is attached to the right abstraction."_

**The decision, in the owner's own words:**

> **D4: Accepted with one clarification.**
>
> _The Answer File remains stated-only and its parser remains untouched. Source-confirmed provenance
> belongs to the AGE intake draft/working record produced by the assisted-intake acceptance path._
>
> _However, the draft must not become a second canonical source of truth for the business. It is an
> intake/working artifact from which the explicit acceptance path produces the canonical
> profile/BIF. The persistence mechanism for making the draft durable is a separate decision and
> must not be smuggled into D4._
>
> **D5: Accepted as written.**
>
> _Arrival from a source is evidence that the source supplied a candidate, not evidence that AGE
> believes the candidate. No source may directly write a BIF, change a business status, or produce a
> score._
>
> **D6: Accepted as written.**
>
> _Every inbound source must identify itself. If source identity is unavailable, AGE refuses the
> inbound fact. AGE must never attribute an unidentified inbound fact to the current operator merely
> to avoid refusal._
>
> **D7: Accepted with one wording clarification.**
>
> _No inbound endpoint may process or accept tenant-scoped data until `askEntitlement` has a real
> caller. The entitlement check must precede application acceptance, persistence, transformation,
> queuing, or other processing of the tenant-scoped payload. The intent is the authorization
> boundary, not a literal TCP-level "before the first byte" requirement._
>
> _These four decisions are therefore accepted in principle. Do not create exceptions or
> implementation shortcuts around them. Surface the separate persistence decision when D4 actually
> requires durable draft storage._

⚠️ And the authorization that followed it, verbatim: **_"let Slice 3 proceed after this"_**.

### 0.5a ⚠️ D4's CLARIFICATION IS BINDING — 🚫 THE DRAFT IS NOT A SECOND SOURCE OF TRUTH

The owner's words:

> _"The draft must not become a second source of truth for the business profile. It should be an
> intake/working artifact, from which an explicit acceptance path eventually produces the canonical
> profile/BIF. Otherwise we risk gradually turning `Answer File → Draft → BIF` into
> `Draft → everything`, and the draft eventually becomes an undocumented shadow database."_

🛑 **THIS FAILURE ARRIVES BY DRIFT, NOT BY DECISION.** No slice will ever propose "make the draft
canonical". It happens one convenience at a time: a reader that finds the draft closer than the
Answer File, a screen that renders the draft because it is richer, a capability that takes the draft
because it is already loaded. Each is locally reasonable, and the sum is a shadow database nobody
chose.

The distinction the owner drew, which is the model:

|                    | **Answer File**                                | **Draft**                                           |
| ------------------ | ---------------------------------------------- | --------------------------------------------------- |
| What it is         | human-authored **input**                       | AGE's **working** intake record                     |
| What it represents | what the client/operator explicitly **stated** | candidate answers **+ provenance**                  |
| Provenance         | 🚫 none — the parser stays hard-coded `stated` | produced by the assisted-intake **acceptance path** |
| Who may write it   | a human, by hand                               | 🚫 **not** by hand — only the acceptance path       |
| Standing           | stable, byte-identical                         | working artifact, 🚫 **never canonical**            |

⚠️ **WHY PROVENANCE MAY NOT LIVE IN THE ANSWER FILE, RESTATED:** the Answer File is hand-edited, so
provenance there would be a **claim anyone can type**. In the draft it can only be _produced_ by the
acceptance path D3 now guards. Provenance must be a record of something that happened, 🚫 never an
assertion someone wrote down.

🚫 **THE PERSISTENCE MECHANISM IS NOT DECIDED HERE, AND MUST NOT BE SMUGGLED IN.** D4 decides
**where provenance belongs conceptually**. Durable draft storage — the store, the schema, the
migration, the RLS — is a **separate decision** that must surface as its own `Proposed` ADR at the
moment a slice actually needs it. ⚠️ Schema/migration/RLS is independently a §3 stop condition.

### 0.5b D5 — arrival is evidence of arrival, 🚫 not evidence of truth

The owner's framing, which generalises the decision past documents to every future integration:

> _"The source can say: 'I found X.' It cannot say: 'AGE now believes X.'"_

⚠️ It applies **identically** to every source the owner named — RankOps, mcp-ads, a CRM, Google Ads,
Meta, LinkedIn, Search Console, GA4, Shopify, WooCommerce, a document, an MCP tool, and any future
API. 🚫 There is no privileged source, and 🚫 no integration earns promotion rights by being
official, first-party, or well-tested.

> _"This protects the architecture from the temptation to build 'smart integrations' that quietly
> become autonomous truth-writing systems."_

🚫 **NO SOURCE WRITES A BIF, MOVES A STATUS, OR PRODUCES A SCORE** — a pushed fact enters as an
answer **candidate an operator confirms**, and nothing else.

### 0.5c ⚠️ D6's CLARIFICATION IS BINDING — TWO EPISTEMIC STATES THAT ARE 🚫 NOT THE SAME

The owner's distinction, and it is the whole decision:

> _"This maintains the distinction between **unknown source** and **known source whose identity is
> unavailable**. Those are not the same epistemic state. The former is a valid absence of knowledge.
> The latter is an invalid provenance assertion."_

Given `value = "40%"` with no identifiable source, AGE must **refuse**. 🚫 It must **not** write
`source = operator:<whoever is authenticated>` — the operator's presence is not the fact's origin,
and attributing it to them is D3's failure wearing a new costume: inventing a provenance to avoid a
refusal. 🚫 It must **not** write `source = unknown` **if that value would subsequently make the
record look legitimate**.

⚠️ This is the same three-valued discipline as ADR-0058 D2's `not-established`: _"we do not know"_ is
a real, representable state — but it is 🚫 **never** a provenance, and 🚫 never a licence to record
the fact anyway.

### 0.5d ⚠️ D7's WORDING CLARIFICATION IS BINDING — THE BOUNDARY IS APPLICATION ACCEPTANCE

The owner closed a loophole in the original phrasing:

> _"'Before the first inbound byte' is conceptually useful, but technically an HTTP server obviously
> receives bytes before application authorization can inspect them. What matters is before the
> application accepts the payload for processing. That wording will prevent somebody from later
> arguing: 'Technically the HTTP server received the request before entitlement.' The architectural
> boundary is application acceptance, not TCP packet arrival."_

**The binding wording:** the entitlement check must precede **application acceptance, persistence,
transformation, queuing, or any other processing** of a tenant-scoped inbound payload. 🚫 "We only
buffered it", 🚫 "we only parsed it to route it", 🚫 "we only enqueued it for later" are **not**
exceptions — each is processing tenant-scoped data before authorization.

⚠️ And the reason it must be `askEntitlement` specifically, in the owner's words: **`caller →
clientId → database` is not entitlement.** The required chain is:

`principal → entitlement → scope → allowed operation → data`

🚫 An ingest endpoint shipped before `askEntitlement` has a real caller is an **unauthenticated
write to a client's record** — the most expensive mistake available in this repository.

### 0.5e The inbound pipeline the seven decisions now define

Recorded because the owner drew it, and because each arrow is a decision that must not be skipped:

```
External source
      |  "I found something"
      v
Source identity        -- D6: named, or refused
      v
Entitlement            -- D7: authorization BEFORE application acceptance
      v
Candidate evidence     -- D5: a candidate, never truth
      v
Operator acceptance
      |-- stated
      `-- confirmed-from-source -- D3: sourceId + locator + confirmedBy, or refused
                    v
                  Draft         -- D4: the working home for provenance, never canonical
                    v
          Canonical profile / BIF
```

⚠️ **And the chain of principles, in the owner's own table:**

|        | Principle                                                                      |
| ------ | ------------------------------------------------------------------------------ |
| **D2** | Provenance doesn't increase truth or score                                     |
| **D3** | Claimed provenance must be complete                                            |
| **D4** | Provenance belongs to AGE's intake draft, 🚫 not the hand-authored Answer File |
| **D5** | Sources propose; they never promote                                            |
| **D6** | Unnamed inbound sources are refused                                            |
| **D7** | Entitlement precedes inbound processing                                        |

🚫 **NO EXCEPTIONS AND NO IMPLEMENTATION SHORTCUTS AROUND ANY OF THE FOUR** — the owner said so in
the acceptance itself, and 🚫 a later slice finding one of them inconvenient is not a reason.

---

## 0.6 The Product Owner answers §7 Q4, verbatim (2026-08-10)

⚠️ **Q4 WAS DEFERRED PENDING A CLIENT MEETING AND IS NOW ANSWERED.** 🚫 It was not self-answered,
and 🚫 it was not inferred from the plan. The owner's words:

> **A second operator.** The pilot human is another operator on our side, using AGE Studio. There
> is no business-owner login in this scope.
>
> The pilot should prove that AGE can safely support a second human operator working against the
> same organization, with identity, entitlement and isolation enforced correctly.
>
> Keep the existing principle from ADR-0062 D2: the business/client is a subject of the system, not
> an authorized principal. A client record does not become an identity merely because the business
> may eventually see AGE.
>
> Do not add any preparatory code, routes, models, permissions, UI, or abstractions for
> business-owner login. If we later decide that a business owner should access AGE directly, that
> must be a separate ADR and implementation decision.
>
> This decision is specifically about who the first real human other than the developer is for the
> pilot: another operator.
>
> Also keep the current V1 boundary intact: read/browse/inspect/understand. Do not interpret
> "second operator" as authorization for business actions or write capabilities beyond whatever has
> already been separately accepted.

### 0.6a Why, in the owner's words — and the one line that changes how slice 7 is judged

> It gives AGE a very important real-world test without prematurely turning AGE into a
> customer-facing SaaS product. The progression becomes:
> **Developer → Operator 1 → Operator 2 → potentially Business Owner later**, and each step proves
> something different.

| Stage              | What it proves                                           |
| ------------------ | -------------------------------------------------------- |
| **Developer**      | AGE works technically                                    |
| **Operator 1**     | AGE works operationally                                  |
| **Operator 2**     | Identity, entitlement and tenant isolation actually work |
| **Business owner** | A fundamentally different product/security/UX model      |

🛑 **THE LINE THAT MATTERS MOST, VERBATIM:**

> **"Operator 2 is not just another login screen. It is the first real proof that ADR-0055's
> entitlement problem has actually been solved."**

⚠️ **THIS IS AN ACCEPTANCE CRITERION, 🚫 NOT ENCOURAGEMENT.** A slice 7 that produces a working
second login while `askEntitlement` still has no real caller has 🚫 **not** done what slice 7 is
for — it has built the login screen and skipped the proof. ⚠️ Recall what `@age/entitlement` is
today: it deliberately has **no caller**, and its guards assert that, precisely because a caller
added casually would silently discharge **ADR-0055 D7**. Slice 7 is where that caller arrives
**deliberately**, with the chain ADR-0066 D7 requires — `principal → entitlement → scope → allowed
operation → data` — and 🚫 never `caller → clientId → database`.

### 0.6b What Q4's answer forbids

- 🚫 **NO PREPARATORY CODE FOR A BUSINESS-OWNER LOGIN — of any kind.** The owner enumerates it:
  routes, models, permissions, UI, abstractions. 🚫 Not a `principalType` union with a second arm
  "for later", 🚫 not a client-scoped entitlement shape nothing calls, 🚫 not a screen behind a flag.
- 🚫 **OPTION 3 WAS CONSIDERED AND REJECTED BY THE OWNER**, and his reason is recorded because it
  will be re-proposed: _"'Business owner is an intended future direction' sounds harmless, but in a
  project with this much architecture and governance, it creates exactly the kind of gravitational
  pull you've been trying to avoid: engineers start making today's decisions 'future compatible'
  with tomorrow's unaccepted product."_ ⚠️ So "future compatible" is 🚫 not a justification here —
  it is the named failure mode.
- 🚫 **ADR-0062 D2 IS UNCHANGED AND IS NOT REPEALED BY THIS ANSWER.** A client remains a **subject**
  of isolation — recorded, 🚫 not authorized. ⚠️ _"A client record does not become an identity
  merely because the business may eventually see AGE."_
- 🚫 **"SECOND OPERATOR" IS NOT AUTHORIZATION FOR BUSINESS ACTIONS OR WRITE CAPABILITIES.** The V1
  boundary — **read / browse / inspect / understand** — stands exactly as it did. ⚠️ A second
  operator is a second **reader**, and ADR-0057 D4's class 3 refusal is untouched.

### 0.6c What is now unblocked, and what still is not

✅ **UNBLOCKED:** slice 7 may be _designed_, and its shape is settled — a second operator principal,
entitlement-scoped to the **same organization** (ADR-0062 D1: the tenant is the organization), with
isolation actually enforced rather than asserted.

🛑 **STILL NOT AUTHORIZED BY THIS ANSWER ALONE.** Q4 removes the _open question_; it 🚫 does not
remove the fences that stand in front of slice 7 independently of it:

- 🛑 The **session store rows** (ADR-0055 A2's Postgres model + migration + RLS) are a **§3 stop
  condition** and need their own slice.
- 🛑 **ADR-0066 D7** still forbids any inbound endpoint accepting tenant-scoped data until
  `askEntitlement` has a real caller.
- ⚠️ **RLS is a coherence constraint, 🚫 NOT an authorization boundary** (ADR-0046 D5) — so
  "Operator 2 only sees their rows because RLS says so" would 🚫 not be the proof §0.6a demands.
- ⚠️ Slices 4–6 come first, in order.

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

**D3. A source-confirmed answer is valid only when its provenance is complete.** ✅ **ACCEPTED
2026-08-10 by the Product Owner — see §0.4, and ⚠️ §0.4a for the binding wording refinement that
replaced this decision's original heading.**

An answer whose provenance is `confirmed-from-source` must carry its `sourceId`, `locator` **and**
`confirmedBy` — complete enough to identify the source, locate the originating material, and
identify the confirmer — or it is **refused**. 🚫 Never defaulted to `stated`, 🚫 never invented,
🚫 never inferred. Losing provenance silently is worse than refusing the answer, because it launders
a document's words into "what the business said" and 🚫 changes the recorded history of how the fact
entered AGE (§0.4c).

🚫 **No exception is created for phone calls, conversations or unpaginated scans.** A future source
type may define its own valid `locator` semantics in its own ADR (§0.4a); 🛑 that is a separate
decision and 🚫 not a weakening of D3.

**D4. The durable home for a confirmed answer is the DRAFT, extended — not the Answer File.**
✅ **ACCEPTED 2026-08-10 by the Product Owner, WITH A BINDING CLARIFICATION — see §0.5 and §0.5a.**
The Answer File stays `stated`-only and byte-identical; its parser keeps its hard-coded provenance.

🚫 **THE CLARIFICATION IS PART OF THE DECISION: the draft must not become a second canonical source
of truth for the business.** It is an intake/**working** artifact from which an explicit acceptance
path produces the canonical profile/BIF. 🚫 `Draft → everything` is the shadow database this
decision exists to prevent, and it arrives by drift (§0.5a).

🚫 **THE PERSISTENCE MECHANISM IS NOT DECIDED BY D4 AND MUST NOT BE SMUGGLED INTO IT.** D4 decides
where provenance belongs **conceptually**. Durable draft storage needs its own `Proposed` ADR at the
moment a slice actually requires it.

---

## 4. What a second source may not do

**D5. Ingest never promotes.** ✅ **ACCEPTED AS WRITTEN 2026-08-10 by the Product Owner — see §0.5
and §0.5b.** ⚠️ The owner's framing carries forward: _arrival is evidence of arrival, not evidence
of truth_ — a source may say _"I found X"_, 🚫 never _"AGE now believes X"_, and this binds every
integration equally (🚫 no privileged source).
A pushed fact enters as an answer candidate an operator confirms.
🚫 No source writes a BIF, no source moves a status, no source produces a score. ADR-0059's
"the extractor proposes passages, not answers" generalises to every future source.

**D6. Every inbound surface names its source, and an unknown source is refused** — 🚫 never
recorded as "unknown" and never attributed to the operator. ✅ **ACCEPTED AS WRITTEN 2026-08-10 by
the Product Owner — see §0.5 and §0.5c.** ⚠️ The binding distinction: _an unknown source_ (a valid
absence of knowledge) and _a known source whose identity is unavailable_ (an invalid provenance
assertion) are 🚫 **not the same epistemic state**.

**D7. `askEntitlement` is called before any inbound surface ACCEPTS A TENANT-SCOPED PAYLOAD FOR
PROCESSING.** ✅ **ACCEPTED 2026-08-10 by the Product Owner, WITH A BINDING WORDING CLARIFICATION —
see §0.5 and §0.5d.** ⚠️ **The original "before any inbound surface accepts a byte" is replaced:**
the boundary is **application acceptance**, 🚫 not TCP packet arrival — the check must precede
acceptance, persistence, transformation, queuing, or any other processing of the payload. 🚫 "We
only buffered it" / "only parsed it to route it" / "only enqueued it" are **not** exceptions.
Today `askEntitlement` has no caller by design. The first inbound network endpoint is the slice that
must give it one — 🚫 an ingest endpoint shipped before that call is an unauthenticated write to a
client's record. ⚠️ `caller → clientId → database` is **not** entitlement; the chain is
`principal → entitlement → scope → allowed operation → data`.

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

⚠️ **Slice 1 is discharged for D1 and D2 only** (§0.1, §0.3).

✅ **SLICE 2 IS SHIPPED — PR #283, `main` `d8c13d8`.**
`buildProfileAndFieldProvenanceFromAnswers` returns the profile **and**, as a separate value,
which question and which `AnswerProvenance` produced each structured field.
`buildProfileFromAnswers` delegates and returns only the profile, so every scorer, the BIF mapper
and the readiness layer are unchanged and still have nothing to condition on. The channel has
**no slot on any profile type**, so **AGE-INV-PROV-1 holds by shape**, not only by discipline.
🚫 It is **not** `fieldEvidence` and must never be folded into it (§0.3c, §3).
**AGE-INV-PROV-1 was made to fail**: teaching the scorer to read `answer.provenance.kind` broke
three guards by name — the intake score, the BIF context, and the static scan of the four
scoring/BIF modules — and was restored with a targeted inverse edit.

⚠️ **ERRATUM RECORDED BY THAT SLICE — the PROFILE itself is not byte-identical across differing
provenance, and that is CORRECT.** `DiscoveryAnswer` has carried a required `provenance` since
#268, so a captured answer's origin travels inside `profile.sections[].answers[]`. 🚫 Do not "fix"
that by stripping it: the answer is the operator's own record of what was said and how it arrived.
AGE-INV-PROV-1 is about **scores and results**, exactly as the owner worded it — and it is pinned
in the harder place, with the difference sitting where every scorer could reach it and none does.

✅ **D3 IS ACCEPTED (2026-08-10, §0.4) — AND IT AUTHORIZES THE REFUSAL RULE, 🚫 NOT THE TABLED
SLICE 3.**

⚠️ **Read this row's authority column before building it.** The slice tabled at row 3 — _"the draft
learns provenance"_ — is authorized by **D4**, which decides that the durable home for a confirmed
answer is the extended draft. 🛑 **D4 is still `Proposed`**, so 🚫 the draft must not grow a
provenance store, and 🚫 the Answer File's `stated`-only parser and its hard-coded
`STATED_ANSWER_PROVENANCE` must not change.

✅ **What D3 authorizes on its own is a slice the table did not name: the completeness rule enforced
at the boundary.** A `confirmed-from-source` `AnswerProvenance` missing any of `sourceId`,
`locator` or `confirmedBy` is **refused** where answers enter, with a message that names the missing
component and 🚫 never echoes a client's words, a source's contents or an organization id
(ADR-0054 D3, ADR-0065 D1). 🚫 It stores nothing, 🚫 changes no score, and 🚫 must leave the pinned
98/63 vs 12/17 baseline and the Answer File byte-identical. That is the slice to build next.

✅ **D4–D7 ARE ACCEPTED (2026-08-10, §0.5), AND THE OWNER AUTHORIZED SLICE 3 EXPLICITLY:**
_"let Slice 3 proceed after this"_. Row 3 — _"the draft learns provenance"_ — is therefore **live**,
under D4 **as clarified**: 🚫 the draft is a working artifact and never a second canonical source of
truth, and 🚫 the durable-storage mechanism is a separate decision that must not be smuggled into it
(§0.5a). The Answer File's `stated`-only parser and its hard-coded `STATED_ANSWER_PROVENANCE`
🚫 still must not change, and the pinned **98/63 vs 12/17** baseline must not move.

⚠️ **Slices 4–6 are authorized in principle by D4–D7 but 🛑 remain SEQUENCED** — each is its own
slice and its own PR, in order, and 🛑 **slice 7 still waits on §7 Q4**, which is DEFERRED. 🚫 No
inbound network endpoint may be built in any of them until `askEntitlement` has a real caller (D7,
§0.5d).

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
   ✅ **ANSWERED 2026-08-10 (§0.6) — A SECOND OPERATOR.** 🚫 No business-owner login is in scope,
   and 🚫 no preparatory code, route, model, permission, UI or abstraction for one may be written.
   ADR-0062 D2 stands unchanged: a client is a _subject_ of isolation, recorded but 🚫 not
   authorized. 🛑 What slice 7 must prove is **not a login screen** but that ADR-0055's entitlement
   problem is solved (§0.6a). ⚠️ The V1 read/browse/inspect/understand boundary is untouched.
5. **Is D2 the right channel for provenance?** ✅ **ANSWERED — accepted 2026-08-09 (§0.3)**, with a
   binding wording correction (§0.3a) and the invariant promoted to **AGE-INV-PROV-1** (§0.3c).

6. **Is D3's refusal rule right — refuse an incomplete `confirmed-from-source` answer, rather than
   downgrade it?** ✅ **ANSWERED — accepted as written, 2026-08-10 (§0.4)**, with a binding wording
   refinement (§0.4a) and 🚫 no exception for phone calls, conversations or unpaginated scans.

7. **Are D4–D7 right — the draft as provenance's home, ingest that never promotes, named-or-refused
   sources, and entitlement before processing?** ✅ **ANSWERED — all four accepted 2026-08-10
   (§0.5)**, with binding clarifications on **D4** (🚫 the draft is not a second source of truth, and
   🚫 persistence is a separate decision — §0.5a), **D6** (🚫 unknown source ≠ unavailable identity —
   §0.5c) and **D7** (the boundary is **application acceptance** — §0.5d).

✅ **EVERY QUESTION IN §7 IS NOW ANSWERED, AND D1–D7 ARE ACCEPTED. THIS ADR HAS NO OPEN
QUESTIONS.** 🛑 That is 🚫 not the same as everything being authorized: slices 4–6 run in order,
and **slice 7 remains gated** on the session store rows (a §3 stop condition), on D7's requirement
that `askEntitlement` gain a real caller, and on its own slice — 🚫 not on this ADR. ⚠️ And Q4's
answer still forbids a business-owner login and every preparation for one (§0.6b).
