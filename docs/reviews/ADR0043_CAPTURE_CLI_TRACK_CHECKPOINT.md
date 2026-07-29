# ADR-0043 — Capture CLI Track Checkpoint

> Scope: the first runtime caller for scored BIF capture. Covers ADR-0043 (Accepted),
> ADR-0044 (Accepted), Slice A (PR #151) and Slice B1 (PR #154).
> This document exists so the working-memory handover does not have to carry the detail.

---

## 1. Ledger

| PR   | What                                                              | Commit → merge        |
| ---- | ----------------------------------------------------------------- | --------------------- |
| #148 | ADR-0043 draft (`Status: Proposed`)                               | `9a36ab3` → `9c4e243` |
| #149 | ADR-0043 amendment — the unimplementable-D6 finding               | `8855c74` → `970c9ef` |
| #150 | ADR-0043 acceptance                                               | `7deba59` → `d5b652b` |
| #151 | **Slice A** — the first production `ScoredBifSnapshotScopeRunner` | `bb616cf` → `30060e9` |
| #152 | Options report for ADR-0043 open question 5 (docs-only)           | → `3ad7711`           |
| #153 | ADR-0044 + the D4 read-path version gate                          | `0022212` → `9c0a673` |
| #154 | **Slice B1** — the capture CLI pure core                          | `c94f294` → `fcac81e` |

---

## 2. ADR-0043 — what it decides

D1 scope = the **capture** caller only · D2 a **CLI** (`apps/capture`) · D3 input = a JSON file
validated by `businessDiscoveryProfileSchema` (the first production `node:fs` read) · D4
`ClientContext` from explicit CLI args + id format validation + echo-and-`--confirm` · D5 the clock
and the id source live **only** in the entry point · D6 the corrected chain (§3) plus
`prisma generate` in `ci.yml` and `apps/capture/**` added to `ci-db.yml` `paths:` · D7 capture is
opt-in and no confidence threshold gates it · D8 live tests as the non-owner `age_app` role ·
D9 two slices · D10 records the write-path-with-no-reader objection as **unresolved**.

### Governance departure, recorded in ADR-0043 §0.1

ADR-0043 was **accepted by the architect, not by the user**, under the user's explicit delegation.
§0.1 quotes the delegation verbatim and states plainly that the acceptance is the architect's under
a stated grant of authority — it is **not** a claim that the user reviewed the ten decisions
individually. **This exception does not generalize.** The standing rule stands: a
`Status: Proposed` ADR is a decision request and is never self-accepted.

---

## 3. The amendment's load-bearing finding

The draft's D6 chain was **unimplementable**. Verified at `9c4e243`:
`ScopedScoredBifSnapshotRepository` is the only repository implementation that sets the ADR-0033
transaction-local GUCs, and it requires a `ScoredBifSnapshotScopeRunner` — an interface with **no
production implementation anywhere**. The only `set_config('age.client_id', …, true)` in the repo
was raw SQL inside `scored-bif-snapshot-rls.db.spec.ts`. Under `FORCE ROW LEVEL SECURITY` (which
fails closed), the draft's chain running as `age_app` would have had **every INSERT rejected** —
D6 and D8 were mutually unsatisfiable.

Corrected chain:

```
PrismaClient
  → ScoredBifSnapshotScopeRunner            (Slice A, PR #151)
  → ScopedScoredBifSnapshotRepository
  → ScoredBifSnapshotCaptureOrchestrator
  → BusinessDiscoveryScoredBifCaptureOrchestrator
```

---

## 4. Slice A (PR #151) — 5 files, +425/−24

`packages/scored-bif-snapshot-persistence/src/prisma-scored-bif-snapshot-scope-runner.ts` —
`PrismaScoredBifSnapshotScopeRunner`, plus two **structural** interfaces
`ScoredBifSnapshotTransactionSource` (`$transaction` only) and `ScoredBifSnapshotScopeTransaction`
(tagged-template `$executeRaw` + `scoredBifSnapshot`). All three exported from the barrel.

- **No `@prisma/client` import** — same reason as `ScoredBifSnapshotDelegate`, so the package stays
  independent of `prisma generate`. The client is a **constructor parameter**: the runner needs a
  client, it does not own one. That is why it lives in the package, not in an app.
- **`$executeRawUnsafe` is deliberately absent from the interface** — what is not offered cannot be
  reached for. Scope ids are always bound parameters; a test uses an injection-shaped id.
- **No omit flag.** A partially-scoped transaction is not a degraded mode. The live suite's
  fail-closed cases keep a partial runner local to the test, where producing a broken state belongs.
- **No error classification** — a rejected transaction propagates unchanged (ADR-0036 D8).
- 27 unit tests + a purity guard; the barrel-export guard test caught the new export, as designed.

**The PR #109 structural-typing risk is CLOSED.** A real generated `PrismaClient` satisfies both
interfaces — proven **by assignment, no cast**, at `scored-bif-snapshot-rls.db.spec.ts`
(`new PrismaScoredBifSnapshotScopeRunner(app)`), verified by `typecheck:db` locally and in
`ci-db.yml`. The suite's private inline `scopeRunner()` copy is gone; its 23 live tests now drive
the production class as the non-owner role.

---

## 5. ADR-0044 — the snapshot read path and consumer

Decided by a **four-lens council** (architecture · adversarial skeptic · security · sequencing) and
self-accepted under the standing architect grant (ADR-0044 §0.2, same precedent as ADR-0043 §0.1).

- **D1** — answer is **D**: no consumer authorized. **A** (a trend/history reader over `listSeries`)
  is named as the destination.
- **D2** — reject C: read-back is a postcondition on `append`, not a consumer.
- **D3** — reject B: redundant in-process, needs Slice B for a clock owner, and smuggles in
  staleness semantics nobody has decided.
- **D4** — the read-path version-gate defect authorized for immediate repair (shipped in #153).
- **D5** — `listSeries` is the over-built member, **not** the schema. Its unbounded signature is a
  recorded future cost, **not** authorized for speculative repair.
- **D6** — the series is an **operator-asserted** chronology, not an observed one.
- **D7** — **Slice B is unblocked and should proceed.**

Revisit trigger recorded in §4: _a production writer has run against a real database and produced
≥2 snapshots for one `(clientId, organizationId, bifId)`._

### The D4 fix (PR #153)

`assertReadableSnapshotVersion(snapshotVersion, caller)` in `scored-bif-snapshot.ts`, called from
**both** `fromScoredBifSnapshot` and `normalizeScoredBifSnapshotRecord`. The read path previously
validated `snapshotVersion` as a bare `z.string()`, so a row written under a future major would have
been read back as though this build understood it — on an append-only table that can never be
migrated in place. Deliberately **not** exported from the barrel: only intra-package callers need
it. 6 new tests, including a wording assertion so the two gates cannot drift apart.

### Two earlier claims overturned on evidence (ADR-0044 §1)

Both survive in the #152 options report, which is **not authoritative** where it conflicts with
ADR-0044:

- **C1** — the claim that the SELECT `USING` policy is never exercised through the scoped adapter
  from production code is **FALSE as of PR #151**. `scored-bif-snapshot-rls.db.spec.ts` builds
  `new ScopedScoredBifSnapshotRepository(new PrismaScoredBifSnapshotScopeRunner(app))` on the
  non-owner `age_app` connection and drives all three reads. Option C's justification is dead.
- **C2** — the claim that `output.items` is permanently empty is **FALSE**.
  `assess-scored-bif-context.ts:285` builds `BusinessContextSupportItem[]` and returns them at
  `:333`. ADR-0027's constraint is about item **content**, not emptiness. A future slice checking
  "is items empty?" would pass while the real rule is broken. **Check content, never length.**

### Council reliability finding (ADR-0044 §0.1)

The sequencing lens was given the options report as context and **repeated the author's own false
claim back as though independently established**. A reviewer handed a document will launder that
document's errors back to its author as confirmation. **Give council lenses the code, not prose,
when the question is a factual one.**

---

## 6. Slice B1 (PR #154) — the capture CLI pure core

New workspace package **`@age/capture`** (`apps/capture`). 10 files changed (9 in the app +
`pnpm-lock.yaml`). 56 tests.

| Module                         | Export                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------- |
| `src/capture-arguments.ts`     | `parseCaptureArguments`, `CaptureCommand`, `ParsedCaptureArguments`               |
| `src/capture-profile-input.ts` | `parseBusinessDiscoveryProfileDocument`, `ParsedBusinessDiscoveryProfileDocument` |
| `src/index.ts`                 | the barrel                                                                        |

### What it deliberately is not

No `PrismaClient`, no composition root, no `node:fs`, no clock, no id generation, no `process`,
**no `bin` entry**, no CI change. A package that can be executed but whose executable half does not
exist is worse than one that cannot. `@age/business-discovery-capture` is **not** a dependency yet —
B1 needs nothing from it, and an unused workspace dependency misrepresents the graph.

### Why the parser refuses rather than guesses

The table this CLI ultimately writes to is append-only, holds `GRANT SELECT, INSERT` only, and has
no `update`/`delete`/`upsert` anywhere above it. A well-formed write of the **wrong** data cannot be
corrected through the application at all, and under `FORCE ROW LEVEL SECURITY` it is not readily
discoverable afterwards from the scope that should have received it. So:

- unknown flags, positional arguments, repeated flags and missing values are all errors;
- a flag is never another flag's value (`--profile --client-id c1` reports a missing `--profile`);
- **every** missing required flag is reported at once, not just the first;
- **padded scope ids are rejected, not trimmed.** `scoredBifSnapshotScopeSchema` uses
  `z.string().trim()`, which would silently rewrite `' client-1 '` into a _different_ id that lands
  in an append-only primary key. The operator's shell history and the stored row would disagree.
  The CLI is not entitled to decide which id was meant.
- capture is opt-in and requires **both** `--capture` and `--confirm` (D4/D7). There is no default
  that writes; `--confirm` alone confirms nothing and is rejected; `--snapshot-id`/`--captured-at`
  are rejected when capture was not requested.
- `--captured-at` must be a canonical UTC instant with milliseconds, validated by regex plus an
  explicit calendar check **without constructing a `Date`**, so the module stays clock-free under
  the purity-guard pattern. `capturedAt` is stored as text and its lexicographic order _is_ the
  series chronology (ADR-0029); two encodings of one instant would sort against each other.

### Why the profile parser takes text, not a path

The filesystem read is the entry point's job (D3/D5). Keeping this function on text is what makes it
pure and exhaustively testable. It does **not** replace the mapper's own guard, which ADR-0040 D10
deliberately does not swallow; it is the earlier, friendlier boundary that turns an unhandled throw
into a named file and a list of field paths, before any scope is echoed and before anything is
written. Both guards stay — the redundancy is the point.

### The purity guard

`src/tests/capture-core-purity.spec.ts` scans all three core modules for `new Date(`, `Date.now(`,
`Math.random(`, `performance.now(`, `fetch(`, `node:fs`, `node:path`, `node:url`, `process.*`,
`console.`, `localStorage`, `@prisma/client`, `@age/persistence`,
`@age/scored-bif-snapshot-persistence`, and BIF promotion. Comments are stripped before scanning
(doc comments legitimately name the forbidden symbols), and the guard first asserts it actually read
every module, so an empty walk can never report compliance.

⚠️ **When B2 adds `main.ts`, do not add it to `CORE_MODULES`.** That guard asserts the _core_ is
pure; adding the entry point would make it unsatisfiable by design.

---

## 7. Slice B2 — what remains

1. **The entry point** (`apps/capture/src/main.ts` + a `bin` entry). It owns every impure thing:
   `process.argv.slice(2)`, the `node:fs` profile read, **the clock and the id source (D5 — here and
   nowhere else)**, the scope echo for `--confirm`, printing, and exit codes.
2. **The composition root** — the corrected chain in §3. Adds `@age/business-discovery-capture`,
   `@age/scored-bif-snapshot-persistence`, `@age/capability-kit` and `@prisma/client` to the app's
   dependencies. In `produceOnly` mode **no `PrismaClient` may be constructed at all** — the
   orchestrator's capture dependency is optional precisely so that path never touches a database.
3. **CI** — `prisma generate` in `ci.yml`, and `apps/capture/**` added to `ci-db.yml`'s `paths:`.
   Without the latter the live gate silently never runs for this app.
4. ⚠️ **Host the live `*.db.spec.ts` in `packages/persistence`, not in `apps/capture`.**
   `packages/persistence/vitest.db.config.ts` includes only `src/**/*.db.spec.ts` relative to that
   package, so a spec under `apps/capture` would be collected by **nothing** and its green would be
   a lie. Run it as the non-owner `age_app` role (D8).

---

## 8. Residuals — recorded, not resolved

- **D4 still trusts its operator.** A correctly-formatted but wrong `--client-id` yields a
  correctly-scoped write of the wrong client's data. Format validation and echo-and-confirm reduce
  the fat-finger case; only an authenticated caller closes the gap.
- **D10 still stands.** Nothing reads snapshots — `findLatest`, `listSeries` and `findBySnapshotId`
  have zero non-test callers. Acceptance authorizes a write path with no reader.
- **The whole persistence half is still reached by nothing but tests.** Slice A supplied the missing
  scope-establishing layer, not a caller; Slice B1 supplied a pure core that cannot be executed.
  `@age/business-discovery-capture` is still referenced by nothing at all.
