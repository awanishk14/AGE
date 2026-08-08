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

## 2. 🛠️ PENDING — the two frontends, and what has to be checked

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
