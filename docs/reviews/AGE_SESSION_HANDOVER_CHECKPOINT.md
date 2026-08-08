# AGE — Session Handover

> Written **2026-08-08**, at `main` **`7268973`** (PR #251, `apps/mcp`).
> Post-merge run `31217487749` — success, **15 executed steps**, matched by full `head_sha`.
>
> ⚠️ **This document names no client.** The operator's real records live outside the repository by
> rule (ADR-0054 D2) and 🚫 must never appear in a commit, redacted or otherwise (ADR-0053 D3).
> Where a real business is involved, this document describes the **position**, never the contents.

---

## 1. Where the product stands

AGE has three runnable surfaces plus a CLI, and they are at three different levels of maturity.

| Surface        | What it is                                              | State                                         |
| -------------- | ------------------------------------------------------- | --------------------------------------------- |
| `apps/api`     | The demo runtime's HTTP surface                         | Shipped. 48 tests + a smoke gate.             |
| `apps/web`     | **The demo frontend** — `/` and `/demo`                 | Shipped, but see §2.                          |
| `apps/studio`  | **The real frontend** — the operator console, 13 routes | Shipped through slice 7; 8 of 12 areas wired. |
| `apps/capture` | The ADR-0054 D6 capture CLI (`onboard`)                 | Shipped. 🛑 Its D6/D7 run has never happened. |
| `apps/mcp`     | The stdio MCP server (#251, ADR-0060 D8 item 2)         | Shipped this session.                         |

`apps/studio` and `apps/mcp` are two front doors onto the **same** nine operations in
`@age/operator-workspace` (ADR-0060 D2). Neither performs an effect itself: each supplies its own
runtime, in its own single effects module, guarded separately.

---

## 2. ✅ CHECKED 2026-08-08 (at `main` `d396dc5`) — the two frontends

> ⚠️ **The result of this verification is §2c below. Read it before re-running any of the boxes:
> every architect-checkable item passed, two findings were recorded, and 🚫 NO CODE WAS CHANGED.**
> The boxes are kept as written so a later session can re-run them, 🚫 not because they are pending.
> 🛑 The parts that need the operator's own machine and the operator's own files are still
> outstanding and are 🚫 not the architect's — they are named individually in §2c.

Both items below are **verification work, not new features**. Neither authorizes a widening, and
🚫 neither is a reason to add a screen, a route or a tool.

### 2a. The demo frontend (`apps/web`) — is what it renders still what the demo produces?

`apps/web/src/app/demo/page.tsx` is a client component that fetches
`GET /demo/capabilities` from `apps/api` and renders it. Its **content** therefore tracks the demo
runtime, but its **rendering** does not — and the demo runtime has moved repeatedly since the page
was last looked at.

**To check, against a running API:**

- [ ] The four scores render as **four separate figures**. 🚫 They must never be combined, averaged
      or badged into one number — intake completeness/confidence and BIF completeness/confidence
      measure different things (§5 of `CLAUDE.md`).
- [ ] **Omitted sections render as omitted, with their reason** — 🚫 never as `0`, never as an empty
      list, never absent from the page. Absence is a limitation, never negative evidence
      (ADR-0026 D4).
- [ ] Readiness rows render **without an aggregate** and **without an ordering** — the states are
      not comparable with one another, and the API smoke gate already asserts there is no aggregate.
      ⚠️ A sorted table implies a scale that does not exist.
- [ ] `output.items.length === 0` renders as **"ran, produced nothing"**, distinct from "did not
      run". ⚠️ Check content, never length (§4 of `CLAUDE.md`).
- [ ] The page says plainly that this is the **demo scenario**, not a real business. 🚫 Mock data may
      never invent a value for a real business (Studio Bible §7.1).
- [ ] Nothing on the page implies execution. The banner rule from #232/#246 applies: 🚫 never
      "read-only" — the honest phrasing is _"No business execution."_

**Known-good baseline to compare against** (must not move): 6 capabilities, 6 pending approvals,
accounting invariant OK, **98/63 intake vs 12/17 BIF**, 7 populated + 5 omitted sections,
`apps/demo/sample-output.txt` byte-identical.

### 2b. The real frontend (`apps/studio`) — client data status

The console has 13 routes. **Eight areas are wired** (`home, businesses, discovery, bif, evidence,
contradictions, intelligence, diagnostics`). **Four are deliberately unwired**, each blocked by a
cause the architect cannot clear: `history` (ADR-0055 D7 — nothing has read the capture store),
`strategy` (`@age/strategy-intelligence-engine` exports zero functions), `execution` (class 3 under
ADR-0057 D4 — **refused, not postponed**), `peer-products` (no contract wired).

**The client-data status that has to be checked — by the operator, on the operator's machine:**

- [ ] **A record file exists** at the path the operator named, outside the repository, and
      `businesses` lists from it. ⚠️ If the variable is unset, the screen must say **which setting is
      missing** — 🚫 never "no businesses", which is a claim about the operator's clients rather
      than about the environment.
- [ ] **A discovery draft and a submitted answer file exist** for at least one real business.
      ⚠️ Confirmed present at the time of writing, by position only — 🚫 contents not read into any
      repository artefact.
- [ ] **Walk the full chain on real data and read what each screen says:** discovery → submit →
      `bif` → `evidence` → `contradictions` → `intelligence`. Every screen must report what it
      _cannot_ say as `not-assessed` **with its reason**. 🚫 Never a zero, never "none", never a
      clean bill of health.
- [ ] ⚠️ **`contradictions` is the one to read hardest.** `detectContradictions` is **not run at all**
      and there is **no import path to it** — over an empty evidence list it would return an empty
      set, which renders as "no contradictions" and turns _"AGE has never looked"_ into _"AGE
      checked and it is sound."_ Confirm the screen says the former.
- [ ] **A low score for the first real client is a CORRECT result** (ADR-0054 D7). 🚫 Do not "help"
      it by touching a cap, relaxing a threshold, or making the mapper infer.

🛑 **The one outstanding operator action, still not the architect's:** the **ADR-0055 D6/D7
onboarding run**. No real business has yet passed through the shipped capture path — every test
drives an injected runtime, so the suite proves the **shape**, not the run. 🚫 **DO NOT SEED A ROW**
to unblock `history`; a seeded row does not substitute for it, and `apps/mcp` deliberately cannot
perform it either (`onboard` is omitted pending ADR-0060 §6 Q1).

### 2c. ✅ The verification result — 2026-08-08, at `main` `d396dc5`

**How it was checked.** `apps/api` was started and `GET /demo/capabilities` fetched live; the payload
was read field by field. `apps/web` (12 tests) and `apps/studio` (108 tests) were run and pass. The
`contradictions` chain was read in source end to end: `reportContradictions` →
`presentContradictions` → `ContradictionsPanel`. 🚫 No code was changed by this verification.

**The live payload matches the frozen baseline exactly:** 6 capabilities · 6 pending approvals ·
accounting invariant `true` · `sideEffectsPerformed: false` · **98/63 intake vs 12/17 BIF** ·
**7 populated + 5 omitted** sections · `bifStatus: Draft`. ⚠️ Recorded here as a measurement, so a
later drift is visible against a date rather than against the document that asserts the rule.

#### §2a — the demo frontend: every checkable item PASSED

- ✅ **Four scores, four figures.** Rendered in two separately-headed boxes ("properties of the
  interview" / "properties of what was produced"), with a note that they are never interchangeable.
  Two tests pin it, including one asserting **no sum, average or headline number** is derived.
- ✅ **Omitted sections render with their reason** — _"Limitations of the intake — not findings
  about the business"_ — 🚫 not as `0`, not as absence. Two tests, one of them pinning **neutral
  styling** so the block can never become an alarm.
- ✅ **Readiness rows carry no aggregate and no ordering.** The payload's readiness object has
  exactly two keys (`incommensurabilityNotice`, `entries`) — 🚫 there is no aggregate to render.
  Rows are emitted in fixed registry order; five tests cover ranking, per-row denominators, the
  non-adopter placeholder and the colour scale. ⚠️ Live payload confirms the three non-adopters
  (`Growth`, `Authority`, `Operations`) arrive with `state: undefined` and render their declaration
  and nothing else — 🚫 no dash, no "N/A", no chip.
- ✅ **The page names itself as the demo** — _"AGE — In-Memory Capability Demo … against local
  fixtures"_ — and the fixture business is transparently fictional.
- ✅ **Nothing implies execution.** `humanApprovedExecution` and `sideEffectsPerformed: false` are
  rendered as boolean invariants, which is the one thing `Notice`'s emerald/amber pair is allowed
  to paint.

**Finding A (recorded, 🚫 deliberately NOT changed) — the word "read-only" survives on the demo
surface**, in `apps/web/src/app/demo/page.tsx` ("Read-only demo. Nothing here is executed") and in
`DEMO_DESCRIPTION` (`apps/api/.../demo.service.ts:24`). ⚠️ The §2a box said the #232/#246 banner rule
applies here. **On inspection it does not, and the difference matters:** ADR-0057 §0.7 retired
"read-only" for the **console**, where it was _false_ (the console writes the operator's files) and
where it stood in for the real refusal (Business Execution). On `/demo` the sentence is **literally
true** — nothing is persisted — and the execution fact is stated separately in the same breath, so
the term is not carrying a claim it cannot support. 🚫 It is therefore left alone. ⚠️ **Two rules
follow, and both matter:** 🚫 the demo's wording must NEVER be imported into `apps/studio`, and
🚫 a future session must not "fix" it here by pattern-match — `CLAUDE.md` §8 itself describes the
demo track as read-only.

**Finding B (latent, 🚫 no change) — "ran, produced nothing" is currently unreachable, not
unhandled.** The live payload gives every one of the six capabilities `1` accepted, `1` rejected and
`1` duplicate, so `ItemList`'s `(none)` branch never renders. ⚠️ The page also has **no "did not
run" state at all** — a card exists only for a capability that ran — so no ambiguity is on screen
today. 🛑 But the distinction is unprotected: if a capability ever returns nothing, `(none)` is what
would render, and it would be the only thing on the page that could be read either way. ⚠️ Whoever
first produces an empty run must render it as _"ran, produced nothing"_ explicitly.

#### §2b — the real frontend: the `contradictions` screen READS CORRECTLY

⚠️ Read hardest, as instructed, and it holds — the danger is designed against rather than avoided:

- ✅ **`outcome` is the single-member union `'not-run'`.** There is no `'consistent'` member to
  render, so 🚫 no future edit can print a clean bill of health by accident. The panel's heading is
  literally **"The detector was not run"**, chipped `not-assessed`, above a paragraph saying an
  empty result _"would be read as a clean bill of health … Nothing about this business has been
  checked."_
- ✅ **No count of contradictions, no "0 found", no green tick.** The two counts shown are _sources
  recorded_ and _of those, readable by the detector_ — deliberately kept apart so the second cannot
  read as "the operator recorded nothing".
- ✅ **`carriesDetectableSignal` is DERIVED, not hard-coded `false`** — if evidence ever gains a
  signal it becomes visible there, which is the seam that forces a rewrite rather than a silent
  start to reporting results.
- ✅ **`unmet` and `unevaluable` get different words** ("Not present" / "Could not be checked"), so
  🚫 _"we could not look"_ is never presented as _"we looked"_.
- ✅ **Nothing happens on mount** (class 2 — a human initiates the act), 🚫 **no principal is ever
  defaulted**, `not-configured` **names the missing variable** rather than saying "no businesses",
  and an untouched session reads _"That is not a statement about this business."_
- ✅ Ten tests pin exactly these, including **"never prints a clean bill of health"** and **"reports
  a missing answer file as nothing recorded, not as nothing wrong"**. `apps/studio`: **108 pass.**

🛑 **STILL OUTSTANDING, and 🚫 NOT THE ARCHITECT'S:** the rest of §2b is a walk over the operator's
**own** files on the operator's **own** machine — that a record file exists at the path they named,
that a draft and a submitted answer file exist for a real business, and what each screen says on
that data. 🚫 The architect cannot perform it without reading a real client's records, which
ADR-0053 D3 refuses. ⚠️ **A low first score is a CORRECT result** (ADR-0054 D7) — 🚫 do not "help"
it with a cap, a threshold or an inferring mapper. 🛑 The **ADR-0055 D6/D7 onboarding run** remains
the one outstanding operator action, and 🚫 **DO NOT SEED A ROW** in its place.

---

## 3. Also pending, in priority order

1. **Re-measure `docs/product/studio/ST_05` (the Coverage Matrix)** — twelve slices stale. Measure
   against `main`, 🚫 not against the document's own claims: #241 corrected a factual error in
   ST_02/ST_05/ST_06 that would have sent a session building a detector that already exists.
2. **ADR-0061 stays `Proposed`** — 🚫 do not self-accept. Identity, a session, a login screen and a
   hosted frontend are each unauthorized; nothing in #249/#250/#251 changed that.
3. **ADR-0059 D1–D5 and D7 stay `Proposed`** — a website URL, a website widget and any model call
   are each refused **by name** in the ADR.

---

## 4. Rules a resuming session breaks most often

- **Never commit** `CLAUDE.md`, `docs/AGE_STANDING_CONTEXT.md`, `docs/PROJECT_STATUS_HANDOFF.md`,
  `docs/superpowers/`. **Stage explicitly — never `git add -A`.**
- **A guard is evidence only once it has been made to fail.** Mutate the thing it protects, confirm
  the guard names the mutation, restore.
- **Verify CI by full `head_sha`** — a short SHA returns `total_count: 0`, which looks exactly like
  an outage. **0 steps is not a gate**, and 0 runs is a different failure from 0 steps.
- **Never take the next ADR number from a document** — run `ls docs/adrs/` first.
- **`CLAUDE.md` is at ~39,930 of a 40k hard limit.** The next checkpoint must **prune before it
  adds**, verbatim-extract first, and verify with a line-set diff.

The durable record lives in `docs/AGE_STANDING_CONTEXT.md` (§12a–§12aa), and the architecture in
`docs/reviews/AGE_ARCHITECTURE_ON_MAIN.md`. 🚫 Neither is safe to act on from a summary.
