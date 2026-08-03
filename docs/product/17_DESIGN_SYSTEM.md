# 17 — AGE Design System

> **Status: Proposed** · Product Bible document · Date: 2026-08-03
>
> Commissioned by the Product Owner, 2026-08-03: _"Now that the Operator Experience exists, I think
> AGE needs one more Product Bible. Not an ADR. A Product Bible. Something like: AGE Design System…
> Otherwise every future screen risks looking different."_
>
> 🚫 **This document authorizes no code.** It is a visual and behavioural contract. The Operator
> Console is its first consumer and is itself blocked on **ADR-0057**, which is `Proposed`.

---

## 0. What this document is, and what it is not

**It is** the answer to "why does every AGE screen look and behave consistently?" — layout,
navigation, components, and the visual encoding of the concepts AGE actually reasons about.

**It is not** a component library specification, a CSS framework choice, or a token file. Those are
implementation decisions and belong to ADR C (`OX_06`), not here.

### 0.1 The one rule that outranks every other rule in this document

⚠️ **This is a design system for an epistemic product. Its primary job is not beauty — it is not
lying.**

AGE's entire value is that it distinguishes _what it knows_ from _what it assumes_ from _what it does
not know_. Every other product's design system optimizes for looking complete. **This one must
optimize for looking honestly incomplete**, because AGE's most valuable output is frequently an
absence, a low score, or a contradiction.

🚫 **No component in this system may make an absence look like a presence, a low confidence look
like a high one, or an unknown look like a zero.** Where a visual convention and this rule conflict,
**the rule wins and the convention is discarded.**

### 0.2 Scope, and the two products

⚠️ `07_UI_NAVIGATION.md` is **Final and Product-Owner-approved** and describes a permission-aware,
multi-user product. `docs/product/operator-experience/` describes a single-operator local console
that 🚫 **must never be promoted into that product** (ADR-0057 D3).

**This design system deliberately spans both**, because visual language is the one layer that
_should_ be shared — a BIF section means the same thing in both, and should look the same in both.

🚫 **Sharing a visual language is not sharing a trust model.** Nothing here grants the console a
capability from Doc 07's product, and 🚫 no component in §5 may assume a user, a role, a permission or
a second person exists. Components that would require those are marked **🔒 Doc 07 only**.

---

## 1. Design principles

Six, in priority order. When they conflict, the lower number wins.

1. **Absence is rendered, never hidden.** An omitted BIF section occupies space and says it is
   omitted. 🚫 It is never collapsed away, never zero-filled, never a placeholder.
2. **Provenance travels with the claim.** A rendered fact and its source are the same component. 🚫
   A value may never appear in one place and its attribution in another, because the two get
   separated by responsive layout and the value survives alone.
3. **Confidence is never averaged.** The four scores are four axes. 🚫 No composite, no single
   "AGE readiness %", no shared gauge.
4. **Refusals are content, not errors.** AGE refusing to answer is a designed state with a layout, 🚫
   not a red toast.
5. **The interface never implies an action it does not have.** Read-only surfaces show no affordance
   that suggests writing.
6. **Density serves comparison.** The operator's core task is comparing — snapshots, sections,
   claims against evidence. Layout optimizes for that over first-impression polish.

---

## 2. Page layout

Three regions, fixed across every screen.

```
┌─────────────────────────────────────────────────────────┐
│ CONTEXT BAR   business · subject · as-of · provenance   │
├────────────┬────────────────────────────────────────────┤
│ NAVIGATION │ CANVAS                                     │
│ (level 1)  │   ├ page header + level-2 nav              │
│            │   ├ primary content                        │
│            │   └ limitations panel  ← always last       │
└────────────┴────────────────────────────────────────────┘
```

**Context bar.** Which business, which subject, and **as of when**. ⚠️ Snapshots are immutable and
append-only, so **every screen is a view of a moment**, and the moment is never implicit. 🚫 A screen
that cannot state its as-of does not render a stale one — it says the as-of is unknown.

**Navigation.** Two levels only, per `OX_02`. 🚫 No third level, and 🚫 no Projects — Projects have no
representation in the architecture.

**Canvas.** Content, ending in the **limitations panel**.

### 2.1 The limitations panel is mandatory

⚠️ **Every screen that renders a claim ends with what AGE does not know about it** — omitted sections,
unanswered questions, unsupported fields, capabilities that could not run.

🚫 It is never a collapsed accordion, never a tooltip, never "advanced details", and 🚫 never omitted
because it is empty — an empty panel states that nothing is missing, which is itself a finding, and a
rare one.

⚠️ This is `ADR-0026 D4` made visual: **missing sections are limitations, never negative evidence.**
The panel says "AGE does not know", 🚫 never "the business lacks".

---

## 3. Navigation

Per `OX_02`, and reproduced here so the design system is self-contained:

| Level | Contains                                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------------------ |
| 1     | Businesses · Discovery · Profile · Intelligence · Strategy · Evidence · Contradictions · Peers · Diagnostics |
| 2     | Tabs within the selected level-1 area                                                                        |

🚫 **Not navigation areas, and the reasons are architectural, not aesthetic:** Organizations (an
`organizationId` has no aggregate and 🚫 no place it may be typed) · Administration (administers users
that do not exist) · Settings (folded into Diagnostics, which _shows_ configuration rather than
accepting it) · Knowledge (⚠️ deferred — BKG has no producer, and the screen would imply AGE knows
more than it does).

---

## 4. The visual encoding of uncertainty

⚠️ **This is the heart of the document.** These four states are distinct and 🚫 must never share a
visual treatment.

| State            | Meaning                             | Encoding                                                         |
| ---------------- | ----------------------------------- | ---------------------------------------------------------------- |
| **Known**        | A value with provenance             | Full-weight text + source chip                                   |
| **Unattributed** | A value AGE holds but cannot source | Full-weight text + **explicit "no source" chip**, never a blank  |
| **Unknown**      | AGE has no value                    | The word **"Not known"** — 🚫 never `—`, `N/A`, `0`, or empty    |
| **Not assessed** | AGE did not evaluate it             | The words **"Not assessed"** — 🚫 never conflated with "Unknown" |

⚠️ **"Unknown" and "Not assessed" are different facts** and the distinction is load-bearing:
`sufficiency === undefined` renders **"Not assessed"** and 🚫 is **never** defaulted to `ready`.

⚠️ **"Ran and produced nothing" ≠ "did not run."** A capability that executed and honestly returned
zero items renders as **"Ran · no signals found"**; one that never ran renders as **"Did not run"**.
🚫 Check item **content**, never length — `output.items` being empty is not the test, and
`ADR-0027`'s constraint is about item content.

🚫 **Colour never carries any of these states alone.** Colour is redundant reinforcement; the word is
the encoding. A colour-blind operator and a greyscale screenshot must both read correctly.

### 4.1 Confidence

Confidence renders as **a value, its basis, and its date** — never as a bare number and never as a
five-star rating, which imports a "quality" metaphor AGE does not mean.

🚫 **Never a progress bar.** A progress bar implies a journey toward 100%, and low confidence is
frequently the **correct terminal state** for a real business.

⚠️ **A low score is a correct result** (`ADR-0054 D7`). 🚫 The design must not style low values as
failures, warnings, or things to fix — no red, no alert iconography, no "improve this" affordance.
🚫 **There is never a UI control that raises a score or lifts a cap.**

---

## 5. Components

### 5.1 The claim card — the atom of the system

Everything AGE asserts renders as a claim card. Five parts, and 🚫 **none is optional**:

1. **The claim** — what AGE says.
2. **The basis** — what it rests on, linked to the evidence.
3. **The confidence** — per §4.1.
4. **The as-of** — when, since snapshots are immutable moments.
5. **The dispute indicator** — present and explicitly negative when nothing disputes it.

🚫 **A claim that cannot fill all five does not render as a claim.** It renders as an unattributed
value, or not at all. ⚠️ This is the single most important component in the system: it is what makes
"why do you think that?" answerable without reading TypeScript.

### 5.2 BIF section block

Twelve sections, each **populated** or **omitted**, and **both render**. An omitted section keeps its
heading and its position and states that it is omitted.

🚫 Never placeholder-filled, 🚫 never collapsed to save space, 🚫 never sorted so omissions fall to the
bottom — position is information, and burying omissions is the failure mode this component exists to
prevent.

### 5.3 The four-score panel

`discoveryCompletenessScore` · `discoveryConfidenceScore` · `bif.completenessScore` · BIF confidence.

⚠️ **Four separate readouts, each labelled with what it measures.** 🚫 No shared axis, 🚫 no shared
widget, 🚫 no average, 🚫 no composite.

⚠️ **Intake completeness and BIF completeness are never interchangeable** — one is how much was
captured, the other how much of the BIF is populated. The labels must make confusing them impossible;
the demo's `98/63 intake vs 12/17 BIF` is exactly the shape that invites the error.

### 5.4 Evidence block

The evidence, its source **named**, its state, and — ⚠️ **most valuably** — the **unsupported-field
list**: what the evidence was expected to support and does not.

⚠️ Discovery evidence and performance evidence are 🚫 **never blended into one confidence figure**
(`ADR-0056 D3`). 🚫 No source-class facet and 🚫 no `QUESTION`/`ENGAGEMENT` types — D1 and D2 were
**rejected**.

### 5.5 Contradiction block

Both sides, both sources, both dates, and 🚫 **no default winner**. AGE disagreeing with itself is a
finding, not an error state.

🛑 **Adjudication has no component here** — recording a judgement in an append-only world is an
unsolved architectural question (ADR F). 🚫 Do not design the button before the decision.

### 5.6 Timeline and snapshot comparison

Snapshots in capture order, each an immutable point. Comparison shows **what changed, what did not,
and what became unknown** — ⚠️ the third is the one systems normally drop, and it matters most.

🚫 **No edit, delete, restore, "set current" or "revert" affordance anywhere, ever.** There is no
`current` flag, no `version`, no `updatedAt`, no `deletedAt` — the schema cannot express these
actions, and 🚫 an affordance that implies otherwise is a lie about the architecture.

### 5.7 Peer product widget

Named by peer, always. Shows **what AGE displays, requests, receives, and reasons about** — 🚫 and
never renders a peer's own UI, 🚫 never writes to a peer.

🚫 **Zero peers renders honestly as zero peers.** No empty-state illustration implying peers are
coming.

### 5.8 Refusal block

AGE declining to proceed. Renders **the domain's own refusal text**, which is written to be read.

🚫 **Never `error.message`. Never a driver's message. Never a stack. Never a connection string.**

⚠️ This is not defensive polish. Three separate refusal leaks reached stderr by splicing a parser
message into a refusal — V8's "Unexpected token" `SyntaxError` **quotes a window of the source**, so a
malformed client record printed a fragment of that record. **A console that catches and renders
`error.message` re-opens every one of them in a browser**, where they are more visible and more
easily screenshotted.

### 5.9 🔒 Doc 07 only

Permission indicators, role badges, user avatars, assignment controls, approval queues, notification
surfaces. 🚫 **None may appear in the console**, which has no second person, no roles, and — per
ADR-0057 D4 as amended — **no writes at all**.

---

## 6. Interaction rules

- **Read-only by default.** ⚠️ Per the Product Owner's 2026-08-03 decision, the console v1 is
  **View · Browse · Inspect · Understand** and 🚫 **never Modify, Execute, Approve or Delete.** 🚫 No
  component may render a control the surface cannot perform.
- **No optimistic UI.** Nothing renders as done before it is done. AGE's outputs are evidentiary.
- **No auto-refresh, no polling, no websockets, no timers.** 🚫 Conflicts with `ADR-0054 D6`
  condition 5 (no background execution, scheduling or automation). All screens are request-scoped
  pull-only.
- **No infinite scroll** where comparison matters — pagination preserves position, and position is
  information.
- **Empty states state the reason.** 🚫 Never a decorative illustration where an explanation belongs.

---

## 7. Content and tone

AGE speaks as an analyst that knows the limits of its own knowledge.

| ✅ Write                   | 🚫 Never write                      |
| -------------------------- | ----------------------------------- |
| "Not known"                | "—", "N/A", "0", blank              |
| "Not assessed"             | "Ready" (as a default), "Pending"   |
| "Ran · no signals found"   | "No results" (hides whether it ran) |
| "AGE does not know X"      | "The business lacks X"              |
| "Disputed by 2 sources"    | "Warning", "Error"                  |
| "Refused: \<domain text\>" | "Something went wrong"              |

⚠️ **Absence is a limitation, never negative evidence** (`ADR-0026 D4`). The distinction between
_"AGE does not know"_ and _"the business lacks"_ is the difference between an honest tool and a
defamatory one, and 🚫 no microcopy may blur it.

🚫 **Unknown is never converted into good or bad.** 🚫 **Insufficient context is a valid _successful_
outcome** and is 🚫 never styled as a failure.

---

## 8. What this document does not decide

🚫 **Not authorized, and each needs its own decision:**

1. **The token system, CSS approach and component library** → ADR C.
2. **Where rendering logic lives.** ⚠️ `apps/web` unit tests are **not functional** — vitest wants
   `jsdom`, which is not installed. 🚫 Logic in a component is untestable logic; it belongs in a
   package, per ADR-0048's precedent, and 🚫 not in a component because that is where the data is.
3. **Any screen's existence** → ADR-0057, `Proposed`.
4. **Adjudication, execution and approval components** → 🛑 blocked on ADR F, and on open questions 3
   and 4.

⚠️ **This document is `Proposed` and is not self-accepted.** It is a Product Bible, not an ADR, so it
does not follow the ADR precedent — but it does describe how AGE presents itself, which is a product
decision. 🛑 **It awaits the Product Owner.**

---

## 9. The compliance checklist

Every screen, before it ships:

- [ ] Omitted sections render **as omitted**, in position
- [ ] The four scores are **four**, unaveraged and individually labelled
- [ ] Every claim carries all five claim-card parts
- [ ] "Unknown" and "Not assessed" are visually and textually distinct
- [ ] "Ran · no signals" and "Did not run" are distinct — checked on **content**, not length
- [ ] The limitations panel is present, last, and rendered **even when empty**
- [ ] No snapshot edit / delete / restore / set-current affordance exists
- [ ] Refusals render **domain text only** — 🚫 no `error.message`, driver message, stack or DSN
- [ ] Peer data is attributed **by name**
- [ ] No colour-only encoding — verified in greyscale
- [ ] 🚫 No control writes, captures, approves or executes (console v1)
- [ ] No score can be raised, recomputed, overridden or capped from the UI
- [ ] 🚫 No real client name appears in any fixture, screenshot or committed file
