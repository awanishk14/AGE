# ADR-0057 — The Operator Console, and the loopback invariant that makes it safe

Status: **Accepted** — by the **Product Owner**, 2026-08-03, in their own words (§0.6).
🚫 **NOT self-accepted.** The architect proposed it and did not accept it; the acceptance is quoted
verbatim in §0.6 and was given in a message that also directed the work that follows it.
⚠️ **Acceptance authorizes the console. It does NOT discharge ADR-0055 D7** (the operator’s own
write), and 🚫 does not answer open questions 2, 3 and 4, which remain stops (§6).
⚠️ **CLARIFIED 2026-08-03 — §0.7 and a rewritten D4.** The term **“read-only” is RETIRED**; the rule
is the **three action classes**: ✅ Platform Administration · ✅ Knowledge Authoring ·
🚫 **Business Execution refused.** 🚫 Do not cite §0.4’s “strictly READ-ONLY” as current.
Date: 2026-08-03
Relates to: ADR-0026 D4 (absence is a limitation, never negative evidence), ADR-0027 (readiness is a
separate named entry point, never a gate on `run`), ADR-0046 D5 (RLS is coherence, not authorization)
and **D7 (no capture writes)**, ADR-0048 (the untested rendering layer, and the split that answered
it), ADR-0053 **D3** (real client records are never committed), **D4** (the operator principal),
**§2.1 dissent 1** (authentication before a second person) and **dissent 2** (no further shape-only
slices), ADR-0054 **D6's five conditions** and **§0.1d** (the stopping point), ADR-0055 **D7**
(the operator's own write), **D8** (the categorical refusals) and **D9 (the security ceiling —
recorded, not scheduled)**, ADR-0056 **D1/D2 (REJECTED)** and **D3**.
Program documents: `docs/product/operator-experience/OX_00`–`OX_07`.

---

## 0. How this decision was reached

### 0.1 Standing

Written under the standing architect grant recorded in ADR-0043 §0.1 and reaffirmed by the mandate of
2026-07-30, and in direct response to the Product Owner's brief of 2026-08-03 establishing the
Operator Experience Program.

🚫 **It is NOT self-accepted, and the grant does not stretch to cover it.** The §2 grant is over
decisions the architect can reason to. Three things here are not:

1. Introducing a **new surface** with a different input device from the CLI.
2. **Standing underneath** ADR-0055 D9's security ceiling rather than clearing it.
3. **Deferring authentication**, which ADR-0053 dissent 1 made a precondition for any exposure beyond
   the operator's terminal.

The Product Owner's brief resolves (3) explicitly — _"Do not introduce authentication yet… assume
single operator, local machine, trusted operator, same trust model as today's CLI"_ — and D2 below is
the architect's account of the **only** construction under which that instruction is coherent. If the
account is wrong, the instruction is unsafe, and that is a judgement for the owner.

### 0.2 What the brief said, and what this ADR adds to it

The brief scoped the program. It did not say **how** "no authentication yet" is kept true, and that is
the whole risk. A trust model that rests on the operator remembering not to expose a port is the same
class of control as a repository that was assumed public while it was private — _"private is not a
control."_ D2 replaces the memory with a refusal.

### 0.3 The reconciliation with a Final Product Bible document

⚠️ `docs/product/07_UI_NAVIGATION.md` is **Final and Product-Owner-approved** and describes a
permission-aware multi-user product over `Organization → Client → Project`. This ADR **does not amend
it** and does not implement it. D3 states the relationship: the console is a precursor surface with a
different trust model, and it must never be promoted into Doc 07's product.

### 0.4 The Product Owner's answers to open questions 1 and 6 (2026-08-03)

> 🛑 **THE ANSWER TO QUESTION 1 BELOW IS SUPERSEDED BY §0.7** — "strictly read-only" was clarified
> the same day to mean **no autonomous execution**, not **no operator-authored data entry**.
> ⚠️ It is kept verbatim because it is the record and because its _reasoning_ still binds; 🚫 do not
> cite it as the current rule. **The answer to question 6 stands unchanged.**

⚠️ **This ADR is STILL `Status: Proposed`.** The Product Owner answered **two of the six** open
questions in §6 and endorsed the reasoning, but 🚫 **did not accept the ADR**, and explicitly named
that as correct: _"He refused to silently reinterpret your instruction. ADR-0057 is Proposed, not
Accepted. That is exactly how governance should work."_ 🚫 **Do not read the endorsement as
acceptance, and do not self-accept on the strength of it.**

**Open question 1 — does the console ever capture, or is it strictly read-only?** Answered verbatim:

> "YES. Very strongly. Version 1 of the Operator Console should be: ✅ View ✅ Browse ✅ Inspect
> ✅ Understand ❌ Modify ❌ Execute ❌ Approve ❌ Delete. Because your CLI is already your trusted
> operator interface. The UI should first prove that it can accurately represent AGE's thinking.
> Only then should it become an action surface."

**Open question 6 — when does the entitlement track start?** Answered verbatim:

> "Start entitlement (J → K → L) in parallel. I agree. Now that you're introducing an Operator
> Console, you are one step away from somebody saying: 'Can my colleague also log in?' Once that
> happens, D9 becomes a production problem instead of an architectural note. So I would not postpone
> entitlement until after the UI."

**Consequences as applied at the time:** D4 was amended to remove the conditional capture · D8 gained
the read-only refusal · §6 questions 1 and 6 were struck as answered · `OX_07`'s Wave 3 was deleted
and the J-track promoted ahead of the console waves.
🛑 **§0.7 then reversed the first, second and fourth of those.** D4 is rewritten around the three
action classes, D8 refuses **class 3** rather than every write, and `OX_07`'s Wave 3 is **un-deleted**
(and blocked on other grounds). ⚠️ **The J-track promotion stands, and is now more strongly
justified**, not less.

⚠️ Four questions — **2 (which peer first), 3 (execution), 4 (the answer file), 5 (the knowledge
graph)** — 🛑 **remain open and are still stops.**

### 0.5 The architecture freeze (Product Owner, 2026-08-03)

Recorded verbatim, and binding on this program:

> "Freeze backend architecture unless a critical defect is discovered. From this point onward, the
> primary effort should move to Identity, Operator Console, and Runtime wiring. New ADRs should exist
> only to support those areas, not to continue refining already-stable core architecture."

⚠️ **This has a consequence the architect will not conceal:** of the thirteen ADRs planned in
`OX_06`, **I (knowledge graph) and H (peer product contract) fall outside all three named areas** and
are therefore **deferred by the freeze**, not merely unscheduled. 🚫 They must not be smuggled back in
as "runtime wiring". ⚠️ **G (strategy engine wiring) and D/E/F (evidence and contradictions) are
runtime wiring and remain in scope** — the freeze protects the domain model and persistence, which are
what "already-stable core architecture" names; it does not freeze the act of _connecting_ what is
already built.

🚫 **The freeze is not a licence to skip governance.** An ADR is still required for each area; there
are simply fewer areas an ADR may be written about.

---

### 0.6 Acceptance (Product Owner, 2026-08-03)

✅ **Accepted.** Recorded verbatim:

> "I would do one thing immediately: Accept ADR-0057. I don’t think there’s much value in keeping
> it in Proposed. The concern Claude has is governance ("don’t self-authorize"), which is correct.
> But from a product standpoint, you’ve already made the decision. Once ADR-0057 is Accepted, it
> becomes the foundation for all frontend work."

And, in the same message, the direction that follows from it:

> "Accept ADR-0057, stop writing major product documentation, and begin implementing AGE Studio.
> Use the existing Product Bible, OX documents, Design System, and AGE Studio document as the
> source of truth. Only create ADRs when a new architectural decision is actually required. Focus
> engineering effort on delivering the Studio shell and progressively replacing CLI-only workflows
> with Studio interfaces while preserving the existing backend contracts."

⚠️ **This ADR was NOT self-accepted.** The precedent ran in full: #224 merged it as `Proposed`,
#225 recorded answers and an endorsement **without** treating either as acceptance, and this PR
flips `Status` with the Product Owner’s own note. 🚫 The architect never accepted it.

#### What acceptance does, and what it does not

| ✅ Now authorized                                                    | 🚫 Still NOT authorized                                                 |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| A local, loopback-only Operator Console exists (D1, D2)              | Any class-3 Business Execution (D4, D8) — ⚠️ **§0.7 rewrote this row**  |
| The Studio shell, navigation, layout and components (`OX_07` Wave 1) | Reading a real business’s snapshots — **ADR-0055 D7** is undischarged   |
| Wiring screens to packages that need no database                     | Exposing the console off `127.0.0.1` (D2, D6, D7)                       |
| Beginning the identity track as ADR J, `Status: Proposed`            | Treating `OperatorPrincipal` as an authorization decision (ADR-0053 D4) |

⚠️ **The single most important consequence to not misread:** acceptance unblocks the _console_. It
does not unblock the _data_. 🛑 ADR-0055 D7 still requires that one real business has passed through
the shipped CLI path before any screen reads a snapshot back — the Product Owner reaffirmed that
rule on the same day: _"That rule has protected the architecture over and over. Don’t weaken it
now."_ 🚫 **Do not seed a row to unblock a screen.**

#### The instruction to stop writing documentation

✅ Adopted. From here the source of truth is: `docs/product/01`–`18`, `OX_00`–`OX_07`,
`17_DESIGN_SYSTEM.md` and this ADR. ⚠️ **One exception the Product Owner named themselves** — the
**AGE Studio Screen Specification**, one page per screen, which they asked for as the implementation
contract between product and engineering. That is the last planned document.

🚫 **"Only create ADRs when a new architectural decision is actually required" is not a licence to
skip one when it is.** Three are already known to be required and are unaffected by this
instruction: **ADR J** (entitlement), **ADR B** (the console’s HTTP surface and how OX-INV-1 is
enforced in code) and **ADR C** (where rendering logic lives, per the ADR-0048 precedent).

### 0.7 The "read-only" clarification — three action classes (Product Owner, 2026-08-03)

⚠️ **This SUPERSEDES §0.4's answer to open question 1 and rewrites D4.** Recorded verbatim:

> "The previous 'read-only' statement was intended to prohibit autonomous execution, not
> operator-authored data entry. Please update the Studio model accordingly. Distinguish three
> categories: **Platform Administration (allowed in V1)** — Create Organization, Invite Members,
> Create Client, Configure Integrations. **Knowledge Authoring (allowed in V1)** — Discovery
> Questionnaire, Generate BIF, Manual Notes, Attach Evidence. **Business Execution (not allowed in
> V1)** — Execute RankOps, Execute MCP Ads, Publish Content, Trigger Campaigns, Any action affecting
> external systems. Update ADR-0057, the Operator Experience documents, and Studio documentation to
> replace the ambiguous term 'read-only' with these three categories. The invariant is: **Human-authored
> knowledge is permitted. System-initiated execution remains prohibited until the execution layer is
> enabled.** No additional ADR is needed if this is merely a clarification of intent rather than a
> change to the execution model."

**Why no new ADR, stated plainly so the judgement can be checked.** The execution model is
unchanged: the boundary AGE actually defends has always been _"nothing reaches an external system,
and nothing acts on its own"_, and that boundary moves nowhere. What changed is a **term**:
"read-only" was read as a statement about _bytes written_ when it was meant as a statement about
_who initiates_. 🚫 The architect will not use this clarification to authorize anything outside the
three lists above.

⚠️ **But three consequences follow that a clarification does not make disappear, and 🚫 none may be
absorbed silently:**

1. 🛑 **"Invite Members" is a second person, and a second person needs authentication FIRST**
   (ADR-0053 dissent 1; D3 above; ADR-0058 D7). ✅ **Authoring an invitation record is permitted.**
   🚫 **An invitation must never grant access**, because there is nothing to grant it to and nothing
   to check it with. Until ADR K exists, an invitation is **a written intention, not a credential**,
   and Studio must say so on the screen that creates it.
2. 🛑 **"Configure Integrations" means credentials for external systems, and AGE has no secret
   store.** ✅ Non-secret configuration (which peer product, which account identifier) is permitted.
   🚫 **No credential, token or API key may be captured, stored or committed** until a secret store
   is decided — that is a genuine architectural gap and it will need its own ADR.
3. ⚠️ **Writes make OX-INV-1 load-bearing in a way reads never did.** §0.4's _"a surface that cannot
   write cannot be tricked into writing for the wrong tenant"_ is 🚫 **no longer true**, and the
   refusal class it removed is **back**. Loopback remains **necessary, not sufficient**.

⚠️ **What this does NOT repeal, named explicitly because a write permission invites the assumption:**
🚫 ADR-0055 D7 (no read path until a real business has passed through the shipped CLI path — 🚫 do not
seed a row) · 🚫 ADR-0054 D6's **five conditions** on `produceAndCapture`, and ADR-0046 D7 elsewhere ·
🚫 ADR-0054 D2/D3 (an operator file's path is never defaulted; an unknown `clientId` refuses) ·
🚫 ADR-0053 D4 (`OperatorPrincipal` is never an authorization decision) · 🚫 the BIF `Draft → Active`
refusal, and every other item in D8 that is not a write.

---

## 1. Context

Everything AGE knows is behind code. A real business's answers go in as a hand-typed JSON file; the
scored result goes into an append-only Postgres row **that has never been read back** — the read path
does not exist (ADR-0055 §0.2 finding 1). The only browser surface is `/demo`: 435 lines rendering a
frozen fictional scenario with `constructedAt` pinned to 2026-01-01.

The operator therefore cannot ask AGE the only questions that matter — _why do you think that, what
supports it, what are you missing_ — without reading TypeScript.

Meanwhile two ceilings are on the record. ADR-0053 dissent 1: the first slice exposing AGE beyond the
operator's terminal must build authentication first. ADR-0055 D9: scope is **asserted by the caller**
and checked only for **self-consistency**, so the moment an HTTP handler derives `clientId` from a
request, every tenant sharing `age_app` reads every other tenant's snapshots — _a property the design
already has, which single-user operation conceals._

A console is precisely the thing that stops concealing it.

---

## 2. Decisions

### D1 — A local Operator Console exists

AGE gains a single-operator, local surface for **seeing what it thinks and why**. Twelve screens,
specified in `OX_01` §4 and `OX_03`. It is a window over existing architecture and 🚫 never redefines
it: every element maps to existing code (`OX_04`) or is listed as a gap (`OX_05`).

### D2 — **OX-INV-1: the console binds to loopback, or it refuses to start**

The listener binds `127.0.0.1` explicitly. A configured host that is not loopback is a **startup
refusal**, not a warning, not a log line, not a degraded mode. 🚫 There is no flag, no environment
override and no `allowRemote` option — for the same reason `openLocalPrismaCaptureConnection` is a
separate function rather than a boolean on the general one: _the copy that gets relaxed still passes
its own tests._

⚠️ **The claim is bounded, and the bound is stated wherever the guard is described.** Loopback is
**NECESSARY, NOT SUFFICIENT.** A reverse proxy, an SSH tunnel, or a published container port in front
of a loopback listener defeats it completely. 🚫 This must never be described as proving the console is
unreachable. It refuses the cases it can see, which is strictly better than refusing none, and the
operator remains responsible for the rest — the identical honesty `assertLocalDatabaseTarget` already
carries.

### D3 — The console is not a draft of the product in Doc 07

🚫 It must never be promoted into a multi-user surface by increments. The moment a second person can
act, or the surface is reachable off the machine, **D6 and D7 below become mandatory first.**

### D4 — **The three action classes** _(rewritten per §0.7; supersedes the "read-only" formulation)_

🚫 **The term "read-only" is RETIRED and must not be used of the console anywhere.** It was
ambiguous in exactly the way that matters: it named a property of _bytes_ when the Product Owner
meant a property of _who initiates_. ⚠️ **This section is the canonical definition** — every other
document points here rather than restating it, so that there is one place to change.

**THE INVARIANT** (Product Owner, verbatim, §0.7):

> **Human-authored knowledge is permitted. System-initiated execution remains prohibited until the
> execution layer is enabled.**

| Class                           | V1             | Contains                                                                                                              | The test that decides membership                                                                |
| ------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **1 · Platform Administration** | ✅ **Allowed** | Create Organization · Invite Members · Create Client · Configure Integrations                                         | Writes AGE's own record of **who and what it is working for**. Effect stops at AGE's storage.   |
| **2 · Knowledge Authoring**     | ✅ **Allowed** | Discovery Questionnaire · Generate BIF · Manual Notes · Attach Evidence                                               | A **human** states or supplies something AGE then reasons over. Effect stops at AGE's storage.  |
| **3 · Business Execution**      | 🚫 **REFUSED** | Execute RankOps · Execute MCP Ads · Publish Content · Trigger Campaigns · **any action affecting an external system** | Something happens **outside AGE**, or happens **without a human initiating it at that moment**. |

⚠️ **Two independent tests put an action in class 3, and either one alone is sufficient:**

1. **Does anything change outside AGE?** Then it is execution, however small, however reversible,
   and 🚫 however clearly the operator asked for it.
2. **Did a human initiate this _specific_ act, now?** If it is scheduled, queued, retried,
   backgrounded, triggered by a state change, or performed on the operator's behalf "because the
   BIF said so" — 🚫 it is execution even if its effect is entirely internal.

🚫 **Test 2 is the one that will be argued away.** An autosave loop, a "keep the BIF fresh" job, a
recompute-on-open, an agent acting on a recommendation: each writes only AGE's own data and each is
**refused**. The invariant says _human-authored_, and a scheduler is not a human.

🚫 **Still refused inside the allowed classes** — an allowed class is a permission to _author_, never
a permission to bypass a decision that has nothing to do with writing: 🚫 no approval or execution
affordance anywhere (class 3) · 🚫 no `Draft → Active` promotion · 🚫 no snapshot edit, delete,
restore, version or "set current" (they are **append-only**) · 🚫 no score improved, recomputed,
overridden or capped · 🚫 no placeholder-filling and no fabricated provenance · 🚫 no `clientId`,
`organizationId` or `OperatorPrincipal` defaulted · 🚫 no credential or API key stored (§0.7, note 2) ·
🛑 **no read of a real business's snapshot until ADR-0055 D7 is discharged, and 🚫 no seeded row.**

⚠️ **The reason the Product Owner gave for the original answer still binds and is not repealed by
this rewrite:** _"the UI should first prove that it can accurately represent AGE's thinking. Only
then should it become an action surface."_ Class 3 is the action surface, and it stays shut.
🛑 **Opening it requires ADR L** — 🚫 it may not be reached by increments, and 🚫 "the operator
confirmed it" is not a substitute for that ADR.

⚠️ **A write connection now exists**, so 🚫 the claim that reads travel over a connection structurally
incapable of writing 🚫 **no longer describes the console.** The refusal class §0.4 believed it had
removed — being tricked into writing for the wrong tenant — is **back**, and it is bounded only by
OX-INV-1 and the entitlement work of ADR-0058. ⚠️ Loopback is **necessary, not sufficient**.

### D5 — Rendering rules that are invariants, not styling

Binding on every screen:

- An omitted BIF section renders **as omitted** — 🚫 never empty, never a placeholder, never a zero.
- The four scores never share an axis, a widget or an average. 🚫 No composite "readiness %".
- `sufficiency === undefined` renders "not assessed". 🚫 Never defaulted to `ready`.
- "Ran and produced nothing" ≠ "did not run". ⚠️ Check item **content**, never length.
- Snapshots carry 🚫 no edit, delete, restore or "set current" affordance, anywhere.
- Peer data is always attributed to its peer **by name**.
- A value with no provenance renders **as unattributed**. 🚫 Never fabricated.
- **The console renders the domain's own refusal text.** 🚫 Never `error.message` from a caught parse
  failure, never a driver's message, never a stack.

⚠️ The last one is not defensive polish. Three separate refusal leaks reached stderr by splicing a
parser message into a refusal — V8 quotes a window of the source, so a malformed client record printed
a fragment of that record. **A console that catches and renders `error.message` re-opens every one of
them in a browser.**

### D6 — The entitlement function is a precondition for any non-loopback surface

ADR-0055 D9 is hereby **restated as binding on this program**: an entitlement function must become the
**only producer** of a `ClientContext` for persistence, **before** any networked surface, and 🚫 never
retrofitted under one. D2 is a **containment**, not a resolution.

### D7 — Authentication is a precondition for any second person

ADR-0053 dissent 1, unchanged. D6 precedes D7: authentication without entitlement authenticates a
caller who can still assert any scope.

### D8 — Categorical refusals

🚫 **No class-3 action of any kind** (D4 as rewritten by §0.7) — 🚫 nothing reaching an external
system, and 🚫 nothing scheduled, queued, retried, backgrounded or performed on the operator's
behalf · no approval or execution affordance · 🚫 **no authentication or second user
modelled, and 🚫 an invitation is never an access grant** · no non-loopback bind · no BIF `Draft → Active`
promotion · no placeholder-filling · no score improved, recomputed, overridden or capped · unknown
never converted into good or bad · no snapshot edited, deleted or versioned · no write to a peer
product and no peer UI rendered · no fabricated provenance, sections, scores or conclusions · nothing
scheduled or backgrounded · no `clientId`, `organizationId` or `OperatorPrincipal` defaulted.

🚫 **No `EvidenceSourceClass` facet and no `QUESTION`/`ENGAGEMENT` signal types** — ADR-0056 D1 and D2
were **rejected**, and this ADR 🚫 does not re-propose them.

### D9 — No code before acceptance ✅ **DISCHARGED 2026-08-03**

✅ **Acceptance was given (§0.6), so D9 no longer blocks.** Code may be written from this ADR.

⚠️ Each wave in `OX_07` still names the ADR that must be Accepted before it. D9 gated _this_ ADR;
🚫 it did not pre-authorize the others. **ADR B, ADR C and ADR J are still required and still
`Proposed`-first.**

🛑 **And acceptance of this ADR does not discharge ADR-0055 D7.** Wave 2 onward is blocked on the
**operator’s own** D6 write. 🚫 Do not seed a row — a seeded row proves only that the reader reads
what this repository wrote.

---

## 3. Consequences

**Positive.** The eight questions in `OX_01` §1 become answerable on screen. The orphaned engines (SIE,
RIE, BKG) gain a destination and therefore a reason to be wired. ADR-0053 dissent 2's ceiling is
honoured: every slice ends in something visible about a real business.

**Negative, and stated plainly.** The console makes AGE materially more useful, and every increment of
usefulness increases the pressure to show it to one more person. **That pressure is the risk this ADR
creates.** D6 and D7 are the answer, and they only work if the J-track (`OX_06`) starts _before_ the
pressure exists — which is now, not later.

**Unchanged.** The demo track stays frozen, fictional and byte-identical: 98/63 vs 12/17, band
`strong`, 7 populated + 5 omitted, `sample-output.txt` untouched. ADR-0046 D7 is not repealed.
ADR-0054 D6's five conditions are untouched.

---

## 4. Alternatives considered

1. **CLI subcommands that print more.** Cheapest, and it fails: provenance, contradictions and history
   are relational, and a terminal cannot render "this claim, and the three things that dispute it".
2. **Build authentication first, then a real UI.** Architecturally correct and rejected by the brief.
   Also slower to the thing that matters: the operator still could not see anything for months.
3. **Extend the demo surface.** 🚫 Refused. The demo is frozen fictional data; making it render real
   business data destroys the one surface whose output is a fixed regression baseline.
4. **A desktop application.** Removes the port question entirely and is the strongest answer to D2 —
   but introduces a packaging and update stack for a single user. ⚠️ **This alternative is not
   foreclosed**, and if OX-INV-1 proves hard to hold in practice it is the right retreat.

---

## 5. Recorded, NOT authorized

⚠️ **Not a to-do list.** Each needs its own `Status: Proposed` ADR, read in its own words:

1. The snapshot read model (`OX_06` A).
2. The console's HTTP surface and how OX-INV-1 is proven (B).
3. Where screen logic lives, given `jsdom` is absent (C).
4. The first evidence ingestion adapter (D) — 🚫 which must not re-propose ADR-0056 D1/D2.
5. Contradiction surfacing and adjudication (E, F).
6. Strategy engine wiring (G) — ⚠️ its own ADR, not a UI slice.
7. The first peer contract client (H) — ⚠️ **which peer is an owner decision**; dissent 3 is open.
8. The knowledge graph producer, or its retirement (I).
9. **The entitlement function (J), authentication (K), and any execution re-introduction (L).**
   ⚠️ L undoes a deliberate revert of PRs #41–#61 and must account for it.

---

## 6. Open questions for the Product Owner

These are stops, not architect decisions.

✅ **1 — ANSWERED 2026-08-03, then CLARIFIED the same day. ⚠️ Read §0.7, NOT §0.4.** The answer is
**not** "read-only": it is the **three action classes** of D4 — Platform Administration ✅ and
Knowledge Authoring ✅ are allowed in V1; **Business Execution 🚫 is refused** until the execution
layer is enabled. 🚫 Do not cite §0.4's "strictly READ-ONLY" as current, and 🚫 do not reopen class 3
by increments.

🛑 **2 — OPEN. Which peer product is first?** Dissent 3 is deliberately open — RankOps is unfinished,
so mcp-ads may be right. ⚠️ **Now also deferred by the §0.5 freeze** (ADR H is outside the three
named areas).

🛑 **3 — OPEN. Is execution re-introduced?** The revert of PRs #41–#61 was deliberate.

🛑 **4 — OPEN, and ⚠️ §0.7 made it URGENT again.** Does the answer file remain the author of record?
Knowledge Authoring is now an allowed class, so the console **can** author discovery answers — which
means there are about to be **two** authors of the same knowledge, the file and the console. 🚫 That
must be answered before Discovery's submit is enabled, or AGE acquires a second, invisible source of
truth (`ST_03` F4). ⚠️ **An allowed action class is not an answer to this question.**

✅ **5 — ANSWERED 2026-08-03: neither fed as a store, nor retired as an idea.** Verbatim in
`18_AGE_STUDIO.md` §5: _"I don’t think AGE should become a graph database product… You need graph
thinking."_ 🚫 No Neo4j, no graph store; storage stays relational; the relationships are **rendered**
as a graph. **ADR I remains ⏸️ DEFERRED** by the §0.5 freeze, and that deferral is now correct for a
second reason: it was never the missing piece.

✅ **6 — ANSWERED 2026-08-03: start the J→K→L track NOW, in parallel.** Verbatim in §0.4. The owner's
reasoning is recorded because it is stronger than the ADR's own: _"you are one step away from somebody
saying 'can my colleague also log in?' Once that happens, D9 becomes a production problem instead of
an architectural note."_
