# ADR-0057 — The Operator Console, and the loopback invariant that makes it safe

Status: Proposed
🚫 **This is a decision request and must NOT be self-accepted.** It introduces a new surface and it
stands underneath a security ceiling the architect did not author — neither is within the §2 grant.
🛑 **No code may be written from this ADR before acceptance** (D9).
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

### D4 — The console performs no write the CLI cannot already perform

Reads, plus the operator's own answer file, plus — **only if the Product Owner answers open question 1
affirmatively** — a confirmed capture under all five of ADR-0054 D6's conditions. 🚫 No new authority
over any data. 🚫 Nothing scheduled, backgrounded or automated (D6 condition 5).

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

🚫 No authentication or second user modelled · no non-loopback bind · no BIF `Draft → Active`
promotion · no placeholder-filling · no score improved, recomputed, overridden or capped · unknown
never converted into good or bad · no snapshot edited, deleted or versioned · no write to a peer
product and no peer UI rendered · no fabricated provenance, sections, scores or conclusions · nothing
scheduled or backgrounded · no `clientId`, `organizationId` or `OperatorPrincipal` defaulted.

🚫 **No `EvidenceSourceClass` facet and no `QUESTION`/`ENGAGEMENT` signal types** — ADR-0056 D1 and D2
were **rejected**, and this ADR 🚫 does not re-propose them.

### D9 — No code before acceptance

🚫 Nothing in this ADR or in `OX_00`–`OX_07` is authorized. The program documents are a record and a
plan. Each wave in `OX_07` names the ADR that must be Accepted first.

⚠️ **And acceptance of this ADR does not discharge ADR-0055 D7.** Wave 2 onward is blocked on the
**operator's own** D6 write. 🚫 Do not seed a row — a seeded row proves only that the reader reads what
this repository wrote.

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

These are stops, not architect decisions:

1. **Does the console ever capture, or is it strictly read-only?** Read-only deletes Wave 3, removes a
   refusal class, and makes OX-INV-1 materially easier to hold.
2. **Which peer product is first?** Dissent 3 is deliberately open — RankOps is unfinished, so mcp-ads
   may be right.
3. **Is execution re-introduced?** The revert was deliberate.
4. **Does the answer file remain the author of record?**
5. **Is the knowledge graph fed, or retired?** It has been an orphan for a long time.
6. **When does the entitlement track start?** ⚠️ **This is the one with a wrong answer.** Starting it
   after a networked surface exists is exactly the retrofit ADR-0055 D9 forbids.
