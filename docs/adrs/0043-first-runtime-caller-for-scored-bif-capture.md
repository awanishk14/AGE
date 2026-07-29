# ADR-0043: First Runtime Caller for Scored BIF Capture

- **Status:** Proposed
- **Date:** 2026-07-29
- **Amended:** 2026-07-29 (still `Proposed`; see §0)
- **Supersedes:** none
- **Related:** ADR-0009 (Client aggregate / `ClientContext`), ADR-0025 (Discovery→BIF prerequisites),
  ADR-0030 (snapshot identity and lifecycle), ADR-0031 (durable snapshot persistence),
  ADR-0032 (Prisma migration convention and live DB testing), ADR-0033 (RLS policy),
  ADR-0035/0036 (capture boundary and orchestration), ADR-0037 (produce-side chain),
  ADR-0039 (demo metadata source), ADR-0040 (capture orchestrator), ADR-0042 (single Prisma schema)

> **This is a decision request. It must not be self-accepted and must not be implemented before the
> user ratifies it.** It exists because the remaining work needs answers this repository cannot
> supply from evidence: where production code starts, what a real input is, and who owns a clock.

---

## 0. Amendment record (2026-07-29)

The first draft of this ADR was reviewed before acceptance under the ADR-0033 / PR #112 precedent —
amend while `Proposed` rather than accept-then-correct. Review found one defect that made the ADR
**not implementable as written**, plus four gaps. All are corrected below; the status is unchanged.

| #   | Change                                                                                                                                                                                                                  | Where        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| A1  | **D6's layering was wrong and unimplementable.** It omitted the RLS scope layer, so D6 and D8 could not both hold. Corrected, and the first `ScoredBifSnapshotScopeRunner` implementation is now explicitly authorized. | §1.4, D6, §3 |
| A2  | **Split into two slices.** The scope runner ships first, on its own, with no new app and no `ci.yml` change.                                                                                                            | D9           |
| A3  | **D4 gains id validation and an echo-and-confirm gate** before any capturing write.                                                                                                                                     | D4           |
| A4  | **`ci-db.yml`'s `paths:` filter must gain `apps/capture/**`,** or the CLI's live test never runs.                                                                                                                       | D6, §3       |
| A5  | **Former open question 3 was a decision in disguise** and is recorded as one.                                                                                                                                           | D7, §4       |

The original D1, D2, D3, D5 and D7 stand. The reasoning that survived review unchanged is left as
written; nothing below has been retro-fitted to look prescient.

---

## 1. Context

### 1.1 The residual this ADR exists to close

Every checkpoint from PR #120 onward has recorded the same sentence: **there is still no runtime
caller.** The phrase has been carried forward so many times that it is worth stating precisely what
is and is not true, verified against the merged tree at `8c25dba` rather than copied from notes.

**The produce side DOES have a runtime caller.** `packages/demo-runtime/src/business-discovery.ts`
calls `produceScoredBifContext` at line 94, and `apps/demo/src/run.ts` invokes it through
`runBusinessDiscoveryIntake(DEMO_SCENARIO_METADATA)`. That path is real, executed by `pnpm demo`, and
prints seven populated and five omitted canonical sections. It is pure: fixture input, fixed
`constructedAt`, no clock, no I/O.

**The capture side has no caller at all.** Verified by searching every `.ts` and `package.json` under
`apps/` and `packages/`:

| Symbol                                          | Callers outside its own package                                                                                         |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `@age/business-discovery-capture`               | **zero** — not imported, and not even declared as a workspace dependency anywhere                                       |
| `BusinessDiscoveryScoredBifCaptureOrchestrator` | **zero**                                                                                                                |
| `ScoredBifSnapshotCaptureOrchestrator`          | **zero**                                                                                                                |
| `@age/scored-bif-snapshot-persistence`          | only `packages/persistence` (its live `*.db.spec.ts` suites), plus one purity guard naming it as a **forbidden** import |
| `new PrismaClient(`                             | only `scored-bif-snapshot.db.spec.ts` and `scored-bif-snapshot-rls.db.spec.ts`                                          |

So the honest statement of the residual is narrower and sharper than "no runtime caller": **the
entire persistence half of the system — orchestrator, capture facade, bound repository, Prisma
adapter, the table, the migration and the RLS policy — has never been reached by anything except a
test.** `@age/business-discovery-capture`, the package built specifically to join the two halves, is
referenced by nothing whatsoever.

That is not an oversight. It was produced by a deliberate sequence of decisions — ADR-0036 D4/D6 kept
production out of the capture orchestrator, ADR-0037 D7 kept persistence out of the produce chain,
ADR-0040 D11 explicitly deferred the caller — each of which was correct in isolation. The result is
that the join is now the only thing left, and it cannot be done without answering questions no
accepted ADR has answered.

### 1.2 Why this needs an ADR rather than an implementation slice

Wiring the first caller is not a mechanical composition step. It is the point at which this
repository stops being pure. Four things that do not exist anywhere in production code today must
come into existence simultaneously, and each is a decision:

1. **A clock.** `ProduceAndCaptureRequest` requires a caller-supplied `capturedAt` (ADR-0030 D4). No
   production module may read a clock — every deterministic module carries a purity guard asserting
   the absence of `new Date(` and `Date.now(`. Something, somewhere, must legitimately read the time.
2. **An id source.** `snapshotId` is caller-supplied for the same reason. `Math.random(` and
   `randomUUID` are equally absent and equally guarded against.
3. **A real `ClientContext`.** `ClientContext` is a two-field class with no producer anywhere in the
   repository. Every existing use constructs one inside a test. ADR-0039 explicitly refused to let
   the demo invent one, calling it "the same fabrication in a different costume".
4. **A composition root that owns `DATABASE_URL` and constructs a `PrismaClient`.** No such thing
   exists. `apps/api/src/main.ts` bootstraps Nest and reads `API_PORT`; it touches no database.

None of these can be chosen "smallest-slice-first", because choosing any one of them constrains the
others. That is the definition of a missing architectural decision.

### 1.3 The constraint that shapes every option below

`ci.yml` — the workflow that runs `Lint, Typecheck, Test, Build` on every PR — **never runs
`prisma generate`.** Only `ci-db.yml`, the separate path-gated live-database workflow, does
(`prisma:generate` at line 105).

This is the reason PR #106 typed `PrismaScoredBifSnapshotRepository` against a hand-declared
structural `ScoredBifSnapshotDelegate` instead of generated Prisma types: `@prisma/client` exposes no
model delegates until generation runs, so a production import of it would make the DB-free typecheck
and build depend on a generation step, and therefore require a change to `ci.yml`.

**Any first runtime caller that constructs a real `PrismaClient` inherits that problem.** It is not
avoidable by cleverness — the composition root is precisely the place where the generated client must
finally be named. This ADR must decide how, and the answer is a CI change, which is otherwise a
standing stop condition.

### 1.4 The layer the first draft missed (A1)

The first draft named the composition chain as `PrismaScoredBifSnapshotRepository` →
`ScoredBifSnapshotCaptureOrchestrator` → `BusinessDiscoveryScoredBifCaptureOrchestrator`. **That chain
cannot work**, and the omission is the single most important thing this amendment corrects.

Verified against the merged tree at `9c4e243`:

- `ScopedScoredBifSnapshotRepository` (`scoped-scored-bif-snapshot-repository.ts:35`) is the **only**
  `ScoredBifSnapshotRepository` implementation that establishes the transaction-local settings
  ADR-0033 D7 requires. It delegates that to an injected `ScoredBifSnapshotScopeRunner`.
- `ScoredBifSnapshotScopeRunner` (`scored-bif-snapshot-scope-runner.ts:38`) is an **interface with no
  production implementation anywhere in the repository.** The only code in the repo that actually
  issues `set_config('age.client_id', …, true)` is raw SQL inside
  `packages/persistence/src/tests/scored-bif-snapshot-rls.db.spec.ts`.
- `PrismaScoredBifSnapshotRepository` issues bare queries and sets no GUCs.

ADR-0033 D6 specifies `FORCE ROW LEVEL SECURITY` with policies that read
`NULLIF(current_setting('age.<id>', true), '')` and therefore **fail closed** when unset. So the
draft's chain, connected as the non-owner `age_app` role that D8 correctly mandates, would have every
`INSERT` rejected by the `WITH CHECK` predicate. D6 and D8 as first written were mutually
unsatisfiable.

This also falsifies the first draft's claim in §3 that the slice requires "no change to the capture
packages themselves." It requires the first production implementation of a port that has never had
one — which is real, non-trivial work (`$transaction`, two `set_config` calls, and binding the
delegate handed to the operation to that same transaction), not wiring.

---

## 2. Decisions proposed

### D1 — Scope: this ADR authorizes the **capture** caller only

The produce side is already called by the demo and needs nothing. This decision is about the first
production code path that reaches `BusinessDiscoveryScoredBifCaptureOrchestrator` and, through it,
the database.

Explicitly **not** in scope, and not authorized by acceptance of this ADR: HTTP or Web exposure,
authentication, tenancy resolution from a request, capability invocation, `Draft → Active` promotion,
reads of persisted snapshots, retention or erasure, and any change to the schema, migrations or RLS
policy.

### D2 — The first runtime caller is a **CLI entry point**, not an HTTP endpoint

**Recommended: a small dedicated app, `apps/capture`, with one command and no server.**

The alternatives and why they lose:

- **An endpoint in `apps/api` — rejected for now.** An HTTP endpoint is API exposure, which is a
  standing stop condition and a genuine product decision. It also drags in questions this ADR has no
  basis to answer: how is the caller authenticated, and how is `ClientContext` derived from a request?
  Getting that wrong is exactly the cross-tenant failure the `?: never` fields were built to prevent.
  A caller that fabricates a key is the one gap the adapter explicitly does **not** close (finding 3
  in the working notes).
- **The demo — rejected on principle.** `pnpm demo` must stay byte-identical and side-effect-free, and
  ADR-0039 already ruled that the demo has no tenancy to model and must not invent one. Making the
  demo write to a database would contradict two accepted ADRs at once.
- **A wiring-only package with no entry point — rejected as a non-answer.** Composition that nothing
  invokes is not a runtime caller; it would leave the residual exactly where it is while appearing to
  close it.

A CLI is the smallest thing that is genuinely _run_. It needs no auth model, no request lifecycle and
no tenancy inference, because its scope arrives as explicit arguments from a human operator. It is
also the natural home for the impure values, per D5.

### D3 — The input source is a **JSON file on disk**, validated before use

The only `BusinessDiscoveryProfile` in the repository is `SAMPLE_BUSINESS_DISCOVERY_PROFILE`, a
fixture. Pointing the first production caller at a fixture would make it a demo with extra steps.

**Recommended:** the CLI takes a path, reads the file, `JSON.parse`s it, and validates it with
`businessDiscoveryProfileSchema` before anything downstream sees it. Invalid input fails loudly with
the schema's own errors and writes nothing.

This is the **first filesystem read in production code** in this repository, and therefore the first
legitimate `node:fs` import. Note that `produceScoredBifContext` already throws on invalid input at
the mapper's own guard, and ADR-0040 D10 deliberately does not swallow that — the CLI's validation is
an earlier, friendlier boundary, not a replacement for it.

### D4 — `ClientContext` is constructed from **explicit CLI arguments**, never from the payload or the environment

`--client-id` and `--organization-id`, both required, no defaults. The CLI constructs
`new ClientContext(clientId, organizationId)` and passes it per call.

- **Never from the profile.** ADR-0030 forbids reading scope from the payload, and
  `BusinessDiscoveryCaptureMapping.organizationId` is typed `?: never` precisely so this cannot
  compile. The permitted direction — scope flowing _into_ the mapper — is already implemented at
  `business-discovery-scored-bif-capture-orchestrator.ts:157`.
- **Never from environment variables.** Ambient scope is how a misconfigured process writes a
  client's data into another client's rows. Arguments are visible in the invocation; env vars are not.

**This is the honest limit, stated plainly:** the CLI trusts its operator. A human who types the wrong
`--client-id` gets a correctly-scoped write of the wrong data, and neither the adapter nor RLS will
object, because scope and key agree by construction. That is the same residual the notes already
record, relocated rather than removed. Closing it requires an authenticated caller, which is D2's
rejected option and a later decision.

**Two mitigations are nonetheless required (A3),** because "we cannot close it fully" is not a reason
to leave it wholly unguarded, and because the cost asymmetry here is severe:

1. **Format validation.** Both ids must be non-empty and must match the id shape the snapshot schema
   already uses. This rejects malformed and copy-paste-mangled input before anything reaches Postgres.
   It is not tenant validation and must not be described as such — there is nothing to validate
   against (open question 2).
2. **Echo and confirm.** Before any `produceAndCapture` write, the CLI prints the resolved
   `clientId`/`organizationId` and requires an explicit `--confirm` flag. This targets the dominant
   realistic failure mode, which is a mistyped argument by a trusted operator, not an attacker — the
   CLI already presupposes shell access and `DATABASE_URL`.

**Why this is worth the friction:** the table is append-only by design — `GRANT SELECT, INSERT` only,
no `UPDATE`, no `DELETE` (ADR-0031). A mis-scoped row therefore **cannot be corrected or removed
through the application at all**; it would need direct owner/superuser intervention, off the audited
path. Worse, because `FORCE ROW LEVEL SECURITY` also scopes `SELECT`, the wrong row is not readily
discoverable afterwards under the scope that should have received it. A rejected write costs nothing;
a wrong well-formed write is permanent and quiet. Prevention is the only available remedy.

D8 must include a test that a malformed id, or a capture requested without `--confirm`, aborts with
no write attempted.

### D5 — The clock and the id source live **only in the entry point**

`capturedAt` = `new Date().toISOString()`. `snapshotId` = `randomUUID()` from `node:crypto`.

Both are read **once**, at the top of the CLI's `main`, and passed down as plain values. No package
gains a clock, an id generator, or randomness; every existing purity guard stays exactly as it is and
keeps passing.

This is the whole point of ADR-0030 D4 having made these caller-supplied in the first place: the
impurity was pushed to the edge so that exactly one file would ever need it. This ADR spends that
budget, once, in the file that is allowed to have it.

**Recommended, and worth arguing with:** both values should also be _overridable_ by explicit CLI
flags (`--snapshot-id`, `--captured-at`). Without an override the CLI cannot be tested deterministically
end to end, and a re-run after a partial failure cannot reproduce the intended identity. With an
override, a caller can supply a duplicate `snapshotId` — which the composite primary key correctly
rejects (`P2002`), so the failure mode is a rejected write, not a corrupted one.

### D6 — The composition root constructs the `PrismaClient`, and `ci.yml` gains a `prisma generate` step

The CLI reads `DATABASE_URL`, constructs `new PrismaClient(...)`, wraps it per the
`@age/scored-bif-snapshot-persistence` layering, and disconnects in a `finally`.

**The corrected chain (A1)** — every layer is required, and the third one does not exist yet:

```
PrismaClient
  → ScoredBifSnapshotScopeRunner        ← FIRST PRODUCTION IMPLEMENTATION, authorized here
  → ScopedScoredBifSnapshotRepository   ← establishes the ADR-0033 transaction-local settings
  → ScoredBifSnapshotCaptureOrchestrator
  → BusinessDiscoveryScoredBifCaptureOrchestrator
```

**The runner implementation lives in `@age/scored-bif-snapshot-persistence`, not in `apps/capture`.**
It is persistence mechanics — a `$transaction` plus two `set_config(..., true)` calls, handing the
transaction-bound delegate to the operation — and it belongs beside the port it satisfies. It is
independent of which caller arrives, so putting it in an app would guarantee rewriting it when the
next caller does. See D9: it ships as its own slice, first.

It must **not** reach past that layering. `ScoredBifSnapshotCaptureOrchestrator` remains the only
thing that constructs the bound facade (ADR-0036), and the CLI never touches
`ScoredBifSnapshotRepository`, the bound facade, or Prisma models directly.

**The consequence, named up front because it is a stop condition being deliberately crossed:** this is
the first production `@prisma/client` import, so `ci.yml` must run `pnpm --filter @age/persistence
prisma:generate` before `typecheck` and `build`. That is a CI change, and this ADR is the
authorization for that specific change and nothing else. `prisma generate` needs no database and no
secret — only the schema — so `ci.yml` stays DB-free.

Review confirmed this is genuinely unavoidable rather than a shortcut. The alternatives all fail:
excluding the CLI's own `main.ts` from typecheck and build the way `*.db.spec.ts` files are excluded
would mean not building the artifact that is the point of the slice; committing generated Prisma
output fights the tool, is engine/platform-specific, and goes stale with no CI signal; and casting
`new PrismaClient()` through `unknown` at the one call site disables precisely the check D6 exists to
force into the open. The reason `ci.yml` had no `prisma generate` was never "codegen is unwelcome" —
it was that a **live database** must stay out of the per-PR workflow. Generation is schema-to-types
with no I/O, so adding it does not erode that.

**`ci-db.yml`'s `paths:` filter must also gain `apps/capture/**` (A4).** That workflow is currently
gated on `packages/persistence/**` and `packages/scored-bif-snapshot-persistence/**`. Without the
addition, a PR touching only the CLI would run the DB-free workflow alone, and the live
`*.db.spec.ts` that D8 requires would silently never execute — a green build that proved nothing. It
is a one-line workflow diff and a direct consequence of the same new import, so it is authorized here
rather than left to be noticed later.

The structural `ScoredBifSnapshotDelegate` in the adapter **stays as it is.** It is not made redundant
by this: it is what keeps the adapter package itself independent of generated code, and PR #109 proved
the two are not identical (a generated delegate satisfies `findUnique`/`findMany` but not `create`,
because `ScoredBifSnapshotRow.context` was wider than Prisma's input type — since narrowed by
ADR-0041). The composition root is where the structural type meets the generated one, and the
assignment either compiles there or the mismatch is real and must be fixed in the open.

### D7 — Capture must be requested explicitly; the default writes nothing

The CLI requires an explicit `--capture` flag to use `mode: 'produceAndCapture'`. Without it the
command runs `produceOnly` and prints a summary, exactly as ADR-0040 D7 intended: a caller who forgets
a flag gets no write, not a surprise one.

The exit code distinguishes the three outcomes the orchestrator already models: produced and captured,
produced but capture failed (non-zero, with the unclassified error reported verbatim), and produced
only. A capture failure must not discard the produced context — ADR-0040 D9 already settled that, and
the CLI prints the context summary either way.

**No confidence threshold gates capture (A5).** The first draft listed this as an open question while
simultaneously stating its answer, which is a decision wearing a disguise. It is decided here: the
CLI captures whatever was produced, at any score. The sample fixture scores 17, and that is not a
reason to refuse it — a snapshot records what was known at a moment, and ADR-0025 is explicit that
absence is never a conclusion. Refusing to record low-confidence knowledge would make the stored
series a biased sample of itself. If a quality gate is ever wanted it belongs to whatever _consumes_
snapshots, not to the writer.

### D8 — Testing: unit-test the CLI's own logic; exercise the real path in `ci-db.yml`

The CLI's argument parsing, validation, exit codes and outcome reporting are ordinary pure logic and
get ordinary tests in the DB-free suite, with an injected fake orchestrator.

The end-to-end path — real `PrismaClient`, real Postgres, real RLS — belongs in `ci-db.yml` as a
`*.db.spec.ts`, following ADR-0032 D13: it must **fail loudly when `DATABASE_URL` is absent, never
`describe.skip`.** It must connect as the **non-owner `age_app` role** and assert that role's own
attributes first, per ADR-0033 D10 — a suite that passes as the owner is a failed suite, because the
owner bypasses RLS.

### D9 — This ships as **two slices**, in this order (A2)

The corrected D6 makes the work larger than one slice, and the two halves have genuinely different
risk profiles and different lifetimes. Splitting them is not ceremony.

**Slice A — the scope runner.** The first production `ScoredBifSnapshotScopeRunner` in
`@age/scored-bif-snapshot-persistence`, plus its unit tests and one live `*.db.spec.ts` proving that
an `INSERT` through `ScopedScoredBifSnapshotRepository` **succeeds** as the non-owner `age_app` role
and that the same operation without the settings **fails closed**. No new app. No `ci.yml` change.
No `PrismaClient` in production code — the runner takes its transaction source as a dependency.

**Slice B — the composition root and CLI.** Everything else in D2–D8, including the `ci.yml`
`prisma generate` step and the `ci-db.yml` path addition.

**Why this order.** Slice A is the piece that is certainly correct to build: it is required by any
caller whatsoever — CLI, HTTP, batch — and is discarded by none of them. It also converts the RLS
policy from something proven only by hand-written raw SQL in a test into something proven through the
adapter that production will actually use, which is the more valuable of the two proofs. Slice B is
the piece the ADR itself concedes may be scaffolding (open question 1). Building the durable half
first means that if the CLI is later replaced, nothing load-bearing is thrown away with it.

If only one slice is ever authorized, it should be A.

### D10 — Recorded objection: this authorizes a write path with no reader

Review raised, and this ADR accepts as a genuine cost: `findBySnapshotId`, `listSeries` and
`findLatest` exist on every adapter and have **zero non-test callers**, and D1 explicitly excludes
reads. Acceptance therefore authorizes writing rows that no production code can observe.

That is recorded rather than resolved, for two reasons. Building the read path first would not close
the residual — reads have exactly the same absence of a caller, and would prove less, because a
reader cannot demonstrate that the RLS write path works. And the write path is what every accepted
ADR from 0030 onward was built toward; stopping short of it indefinitely does not make the system
more honest, only less finished.

**What follows from accepting the objection:** the question "what consumes a snapshot series, and for
what" is the next real decision after this one, and it is a product decision. It should not be
answered by whoever happens to write the next slice.

---

## 3. What acceptance does and does not authorize

**Authorizes exactly two implementation slices, in the order set by D9.**

_Slice A:_ the first production `ScoredBifSnapshotScopeRunner` in
`@age/scored-bif-snapshot-persistence`, its unit tests, and one live `*.db.spec.ts` run as `age_app`.

_Slice B:_ a new `apps/capture` CLI with the composition root of the corrected D6, the input handling
of D3, the scope handling and guards of D4, the impure values of D5, the mode handling of D7, its own
unit tests, one live `*.db.spec.ts`, the single `prisma generate` step added to `ci.yml`, and the
addition of `apps/capture/**` to `ci-db.yml`'s `paths:` filter.

**Corrects the first draft (A1):** that draft said the slice required "no change to the capture
packages themselves." That was false — Slice A is exactly such a change, and it is authorized.

**Does not authorize:** any HTTP endpoint or Web change · authentication or request-derived tenancy ·
any change to `apps/api`, `apps/web`, `apps/demo` or `packages/demo-runtime` · any change to the
schema, migrations, RLS policies, grants or roles · any change to `ci-db.yml` beyond the new specs and
the one `paths:` addition · reads of persisted snapshots · `Draft → Active` promotion · capability
invocation · retention or erasure · any change to the produce-side chain.

**The demo baseline must stay byte-identical:** 6 capabilities, 6 pending approvals, accounting
invariant OK, no side effects, 7 populated and 5 omitted sections.

---

## 4. Open questions — deliberately not decided here

1. **Does `apps/capture` survive, or is it scaffolding?** If an authenticated HTTP caller arrives
   later, the CLI may become redundant. This ADR does not commit to keeping it, and does not treat it
   as the permanent production entry point.
2. **How does an operator obtain a legitimate `clientId`/`organizationId`?** There is no client
   registry, no tenant table, and no ADR-0009 `Client` aggregate implementation. D4 trusts the
   operator because there is currently nothing to validate against. Whether scope ids should be
   verified before a write — and against what — is a real question with no evidence in the repo yet.
3. _(Withdrawn — A5.)_ "Should the CLI refuse to capture below a confidence threshold?" was never
   open: the draft stated its own answer. It is now **decided in D7** — no threshold.
4. **Is a single-shot CLI the right shape at all,** versus a batch or watched-directory ingest? D2
   picks the smallest thing that runs; it does not claim it is the right long-term ingest design.
5. **What consumes a snapshot series, and for what?** Raised by D10. This is the next real decision
   after this ADR, and it is a product decision, not an implementation one.
