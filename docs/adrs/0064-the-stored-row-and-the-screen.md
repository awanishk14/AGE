# ADR-0064 — The stored row and the screen

- **Status:** Proposed
- **Date:** 2026-08-09
- **Supersedes:** nothing
- **Superseded by:** nothing
- **Related:** ADR-0027 (readiness is not a gate), ADR-0046 D5 (RLS is coherence, not authorization),
  ADR-0046 D7 (no `produceAndCapture`), ADR-0053 D6 (the surface AGE needs today is the CLI),
  **ADR-0055 D1 ("and no other surface" — the refusal this ADR asks to narrow)**, ADR-0055 D2 (the
  read façade), ADR-0055 §5 item 1 (cross-snapshot reading unauthorized), ADR-0057 D4 (action
  classes), **ADR-0063 §5 item 2 (which records this work as NOT authorized)**

---

## 0. How this decision was reached

### 0.1 🛑 THIS ADR IS NOT SELF-ACCEPTED, AND MUST NOT BE

The standing architect grant in the operator's working memory covers architectural and sequencing
decisions. **It does not cover this one**, for a specific and checkable reason:

⚠️ **ADR-0055 D1 is an Accepted ADR carrying the Product Owner's own verbatim note, and its
operative words are _"and no other surface"_.** Every decision below is a request to narrow that
refusal. An architect self-accepting the reversal of an owner-accepted refusal would make the
owner's acceptance mean nothing — the refusal would hold exactly until the next agent found it
inconvenient.

🚫 **Do not flip this to `Accepted` under the §2 grant.** The established route applies: merge this
`Proposed` ADR to record the request, the **Product Owner** accepts or rejects it in their own
words, and a **separate** PR flips the status carrying that note verbatim (precedent: #88→#89,
#104→#105, #143→#144, #252→#253).

⚠️ **If the answer is "no", that is a complete and satisfactory outcome.** §4 below states what AGE
looks like under a rejection, and it is not a broken product.

### 0.2 Why the question is being asked now, and not later

ADR-0063 §5 item 2 records "a Studio screen over the assessment" as not authorized. That is a
holding position, not an answer, and holding positions decay: the standing product direction
recorded at #231 is _"The UI is NOT a feature. The UI IS THE PRODUCT."_, and the standing rule
attached to it is that every new backend capability needs a visible Studio home **in the same
milestone** or the milestone is incomplete.

⚠️ **`age-capture assess` (#262) shipped without one.** This ADR is the milestone's missing half
being put in front of the person who owns the fence, rather than being quietly built or quietly
forgotten.

---

## 1. Context

### 1.1 The finding that motivates this ADR: AGE now has TWO readiness answers for one business

This is the substantive discovery, verified against `main` on 2026-08-09, and it was not visible
before #262 shipped.

**Both of these exist today, both are correct, and they do not read the same data:**

|                          | Studio Intelligence screen                                                           | `age-capture assess` (#262)                                                         |
| ------------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Source of the context    | The **answer file** on the operator's disk                                           | The **stored snapshot row** in PostgreSQL                                           |
| How the context is built | `buildProfileFromAnswers` → `produceScoredBifContext`, **recomputed on every click** | `normalizeScoredBifSnapshotRecord` → the codec, **decoded from what was persisted** |
| Assessor entry point     | `buildContextReadinessReport` (`@age/demo-runtime/context-readiness`)                | The three capabilities' own ADR-0027 assessors, called directly                     |
| Mutability of the source | ⚠️ The operator may edit the answer file at any moment                               | ✅ Immutable, append-only                                                           |

⚠️ **THE ANSWER FILE AND THE STORED ROW CAN DISAGREE, AND NOTHING IN AGE WOULD SAY SO.** The row
was captured at one instant; the file has been editable ever since. An operator who corrects an
answer after capture now has a Studio screen reporting readiness over the corrected file and a
stored record reporting readiness over the uncorrected capture — two different verdicts about one
business, each internally honest, with **no surface anywhere that reconciles them or even reveals
that they are different questions**.

🚫 **This is not an argument that the screen should show the stored row instead.** It is an argument
that "which of these am I looking at?" is currently an unanswerable question for the operator, and
that is an epistemic defect of exactly the kind this repository refuses everywhere else.

### 1.2 What is true on `main` today

- **Exactly ONE real snapshot row exists** (ADR-0055 D6/D7, discharged 2026-08-08). ⚠️ A second row
  would need a second real capture; 🚫 **seeding one is refused** and this ADR does not ask for it.
- **`age-capture inspect` (#260) prints that row**; **`age-capture assess` (#262) assesses it.**
  Both are CLI-only, by ADR-0055 D1.
- **`apps/studio` has never touched the snapshot store.** Its effect-isolation guard bans
  `@prisma/client` and `@age/persistence` outright, across every source file under `src/`.
- **The Studio Intelligence screen is already correct** in the ways #262 had to be made correct: it
  names all six capabilities, reports non-adopters as `not-assessed` with a reason phrased about the
  **capability** rather than the business, emits rows in fixed registry order, and publishes no
  aggregate. 🚫 **Nothing in this ADR asks for any of that to change.**

### 1.3 What makes this genuinely hard

The refusal in ADR-0055 D1 is not arbitrary, and three of its reasons still hold in full:

1. **A screen is a standing invitation.** A CLI read is a thing the operator deliberately typed. A
   screen renders whenever it is opened, and "opened the page" is a much weaker act of intent than
   "typed the command".
2. **`apps/studio` is a server.** ADR-0053 dissent 1's ceiling and ADR-0053 D6 both say the surface
   AGE needs today is the CLI, and 🚫 anything networked must build authentication first (ADR-0055
   D9). ⚠️ **The console binds loopback only** (#254), which is a real mitigation — but a loopback
   host is **necessary, not sufficient**, and this repository has said so by name.
3. **RLS is a coherence constraint, NOT an authorization boundary** (ADR-0046 D5). 🚫 A screen that
   reads scoped rows must never be described, in code or in prose, as though the database were
   deciding who may see them.

⚠️ **The counter-argument is §1.1**, and it is not a convenience argument. The current state does
not merely lack a feature; it presents two answers and names neither.

---

## 2. Decisions requested

⚠️ Each is a separate yes/no. **D1 may be rejected while D5 is accepted**, and a partial answer is
a useful answer.

### D1 — The console may READ the snapshot store, through the ADR-0055 D2 façade and nothing else

Requested: `apps/studio` may reach the stored row, and the reach is **the existing narrowed read
façade** — the one whose whole design point is that it cannot `append`.

🚫 **No new composition function, no second reader, no `ScopedScoredBifSnapshotRepository`.** The
façade returns reads only; a screen holding a live append handle is the `produceAndCapture` that
ADR-0046 D7 forbids, arriving through a door nobody was watching.

⚠️ **The effect-isolation guard's `BANNED` list must be NARROWED, NOT DELETED.** `@prisma/client`
and `@age/persistence` would become permitted in **exactly one** module —
`server/operator-environment.ts`, which is already the sole effect module — and stay banned in every
other file under `src/`. 🚫 **A guard that is deleted rather than narrowed is a guard that stopped
being evidence**, and the narrowing must be asserted by a test that fails when a second module
imports either package.

### D2 — The screen reads; it never writes, never captures, never re-scores

🚫 No `append`, no "capture now" button, no "refresh the snapshot", no re-score-and-store, no
remediation. ⚠️ Opening the page performs **no** write of any kind, and the append-only invariant is
untouched. 🚫 The demo baseline must not move: **98/63 intake vs 12/17 BIF**, band `strong`, 7
populated + 5 omitted, `sample-output.txt` byte-identical.

### D3 — 🛑 THE TWO PROVENANCES ARE SHOWN SEPARATELY AND ARE NEVER MERGED

This is the decision the whole ADR exists for, and the one most likely to be undone by a later
well-meaning simplification.

⚠️ **The stored-row assessment and the answer-file assessment must appear as two distinctly labelled
things, each naming its own source and its own instant.** 🚫 They must never be combined into one
"readiness" section, never averaged, never reconciled, and 🚫 **neither may be silently preferred**
when they disagree.

🚫 **A disagreement between them is DISPLAYED, never resolved.** AGE has no basis for deciding which
is right — the file may be a correction or a mistake, and nothing in the system knows which. The
honest rendering is _"the stored capture says X; the current answer file says Y; these are different
questions and AGE does not know which you mean"_. 🚫 Never a diff presented as drift, never an arrow,
never "out of date", never a colour that codes one as worse.

### D4 — One row is one row, and its singularity is stated on the surface

⚠️ **ADR-0055 §5 item 1 leaves cross-snapshot reading unauthorized and this ADR does NOT ask for
it.** The screen shows the latest row in scope.

🚫 **It must not imply a history it cannot show.** No "latest of N", no timeline, no "previous", no
pagination affordance, no empty list that reads as "nothing happened". Where only one row exists,
the surface says so plainly. 🛑 **DO NOT SEED A ROW** to make a list look populated.

### D5 — A missing row is a named state, never an empty screen

⚠️ `findLatest` returning nothing renders as _"no snapshot has been stored in this scope"_ — a named
epistemic state carrying its reason. 🚫 **Never an empty panel, never a zero, never "no data", and
never a clean bill of health.** A corrupt row propagates its refusal and 🚫 must never render
partially.

⚠️ This is `detectContradictions`' failure mode restated: an absent look must never render as a
completed look that found nothing.

### D6 — No aggregate, no ranking, no verdict — unchanged from #262

🚫 No band, no count, no "2 of 3 ready", no badge, no progress bar, no ordering by state, no colour
that encodes rank. ⚠️ All six capabilities are named; the three without assessors report
`not-assessed` **with the reason phrased about the capability**, never about the business. An absent
sufficiency prints `not-stated`, 🚫 never `ready`.

⚠️ **`insufficient` and `blocked` are honest PASSES.** 🛑 A `ready` on the one real row today would
be evidence of a **defect** (ADR-0063 D9). 🚫 Do not touch a threshold, cap, weight or predicate to
make a screen look better — a low first-client score is a **correct result** (ADR-0054 D7).

### D7 — This authorizes no identity, no second human, no hosted surface

🚫 The console stays loopback-bound (#254): `boundHost()` must not regain a flag, parameter or env
read. 🚫 No login, no session, no `apps/api` route, no `apps/web` change, no MCP tool.
⚠️ Identity remains **"not established"** — the third value that is never `true` and never `false`
(ADR-0058 D2), and 🚫 it must never render green.

---

## 3. What this ADR does NOT claim

- 🚫 It does not claim the operator has asked for this screen. They have not. It is the standing
  #231 direction applied to #262's output, and it is a **request**, not a plan of record.
- 🚫 It does not claim §1.1's divergence has caused harm. With one row and one operator it has
  almost certainly caused none **yet**. The claim is that the divergence is unstatable today.
- 🚫 It does not claim reading is safer than writing in general. It claims **this** read is narrow,
  through a façade that structurally cannot write, into a surface that binds loopback only.
- 🚫 It does not repeal ADR-0053 D6, ADR-0055 §5 item 1, ADR-0057 D4, ADR-0058 D4 or ADR-0062, and
  it answers none of ADR-0061's open questions.

---

## 4. Consequences

**If ACCEPTED:** one slice adds a read path from `apps/studio`'s single effect module to the
snapshot store, a screen showing the two provenances side by side, and a narrowed — not deleted —
effect-isolation guard. ⚠️ The guard narrowing is the part most worth reviewing closely, because it
is the one change that makes a future mistake cheaper.

**If REJECTED:** ✅ **AGE remains coherent and nothing is broken.** The stored row stays readable by
`inspect` and assessable by `assess`, both deliberate CLI acts by the one human who has the records.
The Studio keeps answering the answer-file question, which is the question its screens were built
for. ⚠️ **The §1.1 divergence should then be documented on the Intelligence screen itself** — one
sentence naming that this assessment reads the current answer file and not the stored capture — and
that sentence needs no ADR, because saying what a screen is looking at is not a new surface.

**If DEFERRED:** ⚠️ the divergence persists silently and grows with every additional captured row.
🚫 That is the one outcome with no honest story, and if the answer is not yet known, the rejection
path's one-sentence disclosure should ship regardless.

---

## 5. Recorded, NOT authorized

⚠️ **Not a to-do list.** Each needs its own fresh `Status: Proposed` ADR. **Next number after this
one is 0065.**

1. Cross-snapshot reading, a history list, or any diff between two rows — ADR-0055 §5 item 1 still
   governs, and 🛑 there is exactly **ONE** row.
2. Storing an assessment result. This screen would compute and display; it persists nothing.
3. Giving Authority, Growth and Operations a context assessor. 🚫 Not to remove three
   `not-assessed` rows — that is the wrong reason and would reopen ADR-0026's threshold question.
4. Acting on any assessed state, including rendering "gather this next" as an instruction rather
   than as the assessor's own reported hint.
5. Any MCP tool over this read (ADR-0060 D8 closed that surface), authentication, and ADR-0055 D9's
   entitlement function.
