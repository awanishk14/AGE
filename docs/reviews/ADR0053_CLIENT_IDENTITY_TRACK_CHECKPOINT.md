# ADR-0053 — Client identity track checkpoint

> Per-PR record for the client-registry / operator-principal track. Append, never rewrite.
> Read this before touching `@age/client-registry` or `buildContextReadinessReport`.

## Why this track exists

Four consecutive slices reported themselves blocked on "authentication". They were not. Three of the
four blockers reduce to **one missing fact**: `ClientContext` had no way to name a real business, and
**identity had been conflated with authentication**. A scope that only ever holds
`('client-demo-001', 'org-demo-001')` cannot be told from a scope that is hardwired.

⚠️ This track does **not** add authentication and does not claim to. See ADR-0053 §3.

---

## §1 — ADR-0053 proposed and accepted (#206, #207)

|      |                                                                                                                                                                                         |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #206 | `docs/adrs/0053-client-registry-and-operator-principal.md`, `Status: Proposed`. Merged to record it. PR CI **success, 15 steps**. `main` → `a584617`. Post-merge **success, 15 steps**. |
| #207 | Flips to `Status: Accepted`, adds **§0.1b**. PR CI **success, 15 steps**. `main` → `bf8aae8`.                                                                                           |

⚠️ **NOT self-accepted.** The ADR was put to the user together with two things the architect grant
does not cover — a position on **provenance** (`operator:<handle>` stamped permanently onto history)
and a position on **how the user's three products relate commercially** (D7). The user accepted it
verbatim:

> _"1. accept it, 2. amend it, meanwhile work go ahead"_

### 🚫 ADR-0052 / PR #205 was WITHDRAWN — closed unmerged, no code written from it

It proposed a client-side `/discovery` page in `apps/web`. Two reasons, both recorded in ADR-0053 §0.3:

1. Its **own dissent-2 ceiling** — _"the next slice on this line cannot also be one that discards its
   output"_ — was violated the moment a real client existed.
2. A browser form is the wrong surface for an operator who drives everything from a terminal (D6).

⚠️ **Do not resurrect it.** ⚠️ And do not cite it as having addressed `POST /discovery/analyze`'s two
blockers: it **avoided** them.

---

## §2 — Slice A shipped: D1–D5 + D9 (#208)

Branch `feat/adr0053-client-registry`, commit `a8698ec`, base `bf8aae8`, 16 files.
PR CI **success, 15 steps**. Merged → `main` = **`0a7d43f`**.

### What shipped

- **D1 / D2** — new pure package **`@age/client-registry`**: `ClientRecord { clientId,
organizationId, displayName, externalRefs }`, `parseClientRecord`, `toClientContext`,
  `findClientRecord`, `findExternalRef`, plus `clientRecordSchema` / `externalRefsSchema`.
- **D4** — `OperatorPrincipal` (`operator:<handle>`, branded), `operatorPrincipal`,
  `isOperatorPrincipal`, `parseOperatorPrincipal`.
- **D3** — `FICTIONAL_CLIENT_RECORDS` + `FICTIONAL_MARKER`, fixtures only.
- **D5** — `clientContext` is a **required parameter** of `buildContextReadinessReport`.

### ⚠️ Do-not-undo list

- 🚫 **This is NOT the ADR-0009 `Client` aggregate and must not become one.** ADR-0009 stays
  reserved. No lifecycle, no status, no `Draft → Active`, no business attributes. The moment a field
  appears that a **capability would reason over**, the wrong thing is being built — that fact belongs
  in the **BIF**, where it gains provenance, confidence and version history.
- 🚫 **`externalRefs` is an OPEN map, not an enum of blessed systems.** New tools will be added and
  adding one must not require editing AGE. Keys are validated non-empty, never checked against a list.
- 🚫 **AGE holds the mapping; the external systems change nothing.** A shared AGE-minted identifier
  was **weighed and rejected** — mcp-ads runs live spend today and RankOps is mid-build. AGE is the
  newcomer and therefore **AGE absorbs the translation**. The dependency arrow points from AGE
  outward and **never back** (D7).
- 🚫 **REAL CLIENT RECORDS ARE NEVER COMMITTED. The repo is PUBLIC.** Not even redacted or masked —
  _"a masked ad account id is still an assertion about who the operator's clients are."_ Real records
  come from a **local, gitignored** source at run time. 🚫 Do **not** "make the fixtures more
  realistic": their obvious fictionality is the control.
- 🚫 **`OperatorPrincipal` is never defaulted, generated or inferred, and is never an authorization
  decision.** There is deliberately **no** `operatorPrincipalOrDefault`, no `SYSTEM_PRINCIPAL`, no
  anonymous fallback, and a test asserts no export matches `/default|fallback|anonymous|system/i`.
  ⚠️ ADR-0050 D5/D7's blockers refused a **fabricated** principal; this is _"a smaller true claim, not
  a smaller lie"_ — it asserts only that a named human operator acted.
- 🚫 **`findExternalRef` returns `undefined` when a system is not mapped.** A business with no Meta ad
  account is **not** a business with an empty Meta ad account (ADR-0026 D4 — absence is a limitation,
  never a conclusion). Same for `findClientRecord`: an unknown id is a **missing fact, not a new
  client**; fabricating one would put a scope into circulation that names nothing.

### ⚠️ D5 — `clientContext` supersedes ADR-0047 D9

`buildContextReadinessReport(scoredBifContext, { producedAt, clientContext })`.

- 🚫 **NO DEFAULT** (ADR-0049 D2). A default makes the stage **unfalsifiable behind a signature that
  only looks parameterised** — worse than the hardwired import, which was at least honest.
- 🚫 The stage **no longer imports a fixture context at all**. A guard scans the source (comments
  stripped) and fails if `demoContext` reappears. ⚠️ This is why the runtime error message says
  _"a fixture context"_ rather than naming the symbol — the symbol name in a string would trip the
  guard against itself.
- Both demo callers (`apps/demo/src/run.ts`, `apps/api/.../demo.service.ts`) pass `demoContext`
  **explicitly**.
- ⚠️ **The divergence from `DEMO_SCENARIO_METADATA.organizationId` is RECORDED, not reconciled.**
  `ScoredBifContext` carries no scope, so the FINDINGS are correct either way and only the envelope
  diverges — and the envelope is not published (D8). 🚫 Do **not** "align" them by building a context
  from the scenario org: ADR-0039 says that value _"is not a tenant, it is not scope, and it must
  never be treated as one."_

### ✅ Baseline unmoved — this is what D5 was checked against

**98/63 intake vs 12/17 BIF**, band `strong`, **7 populated + 5 omitted**, 6 capabilities,
6 pending approvals, accounting invariant OK, `sample-output.txt` **untouched**,
API smoke: _6 readiness rows with no aggregate, no side effects_.
⚠️ D5: _"If it moves, something other than this plumbing changed and the change is wrong."_

### D9 — every guard was MADE TO FAIL before being trusted

| Guard                            | Mutation                                                            | Result                                                                  |
| -------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| purity of `@age/client-registry` | injected `new Date()` into `client-record.ts`                       | failed, naming `new Date(`                                              |
| fixtures stay fictional          | renamed a fixture to a real client name                             | failed **two** tests (the `fictional` label and `names no real client`) |
| `clientContext` required         | restored a `?? demoContext` default **and** re-imported the fixture | failed **three** readiness tests                                        |

Also guarded: no fixture `externalRefs` value matches `/[1-9]\d{8,}/` (a plausible Google Ads /
Meta account id); the purity walk asserts it **found files first**; comments are stripped before
scanning; declared dependencies are exactly `['@age/capability-kit', 'zod']`.

Counts: `@age/client-registry` **46 tests**, `@age/demo-runtime` **44**, `@age/api` **48**.

---

## §3 — What this track deliberately does NOT claim

- **No authentication.** An `operator:<handle>` is **unverified**. Dissent 1 was upheld as a stated
  limitation, with a ceiling: ⚠️ **the first slice that lets a second person act, or that exposes AGE
  beyond the operator's terminal, must build authentication first.**
- **No persistence write, no `produceAndCapture`, no BIF change, no RIE adapter, no external call,
  no `Client` aggregate** (D8).
- ⚠️ **Naming is not reachability.** A package that exists is not a package that runs.

### ⚠️ THE CEILING ON THE NEXT SLICE — stricter than ADR-0052's

Dissent 2 (skeptic): this is the **fifth shape-only slice**. Partially upheld —

> **the next slice must make an actual client's answers produce an actual stored result.**

⚠️ D5 is why slice A is not merely more shape: the registry gains a **reader in the same slice**.

Dissent 3 (sequencing): RankOps is unfinished, so **mcp-ads may be the right first integration**.
Accepted and **deliberately left open**.

---

## §4 — Standing, unanswered, carried forward

1. ✅ **RESOLVED — PR #209 landed.** The Product Bible amendment introducing the **peer product** was
   **approved by the Product Owner** and merged (`31e97c1`), with a refinement in **#211**
   (`74e850b`). ADR-0053 D7 may now be cited as having changed the Bible. ⚠️ The live sections are
   `docs/product/11_INTEGRATION_CATALOG.md` §2.1/§2.1.1/§6.1 · `02` §16.1 · `12` §6.1 · `13` §3.1 —
   **read those, not this summary.** Per `START_HERE.md` §4 the Bible still outranks an ADR.
2. ⚠️ **Open question put to the user, unanswered:** is **mcp-ads-server** _the_ ads Execution Layer
   (the recommendation), or does AGE build its own ads execution and call mcp-ads underneath?
3. ⚠️ **Not one real business has passed through AGE.** ~200 merged PRs, six capabilities, a frozen
   architecture — and every surface is fed by **one frozen sample profile**. The falsifiable test
   offered to the user: **by the end of slice B, vTEST's real answers should produce a stored profile
   you can look at.** If that has not happened, the problem is the **method**, not the next slice.
   ⚠️ **Slice B has now shipped the PATH (#214/#215/#216/#217 — see
   `ADR0054_FIRST_REAL_CLIENT_TRACK_CHECKPOINT.md`), which is NOT the same as having passed a real
   business through it.** The suite drives an injected runtime; the actual local run is the
   operator's to perform. 🚫 **Do not mark this item resolved until a real row has been written and
   read back.**
4. 🚫 **The operator's live client names must never be committed** (D3). ⚠️ They are held as
   **digests** in `@age/client-registry`'s `forbidden-client-names.ts` and 🚫 never spelled out —
   the guard used to list them, which made the rule its own exception. ⚠️ mcp-ads touches **live spend**; its safety rules are not optional.
