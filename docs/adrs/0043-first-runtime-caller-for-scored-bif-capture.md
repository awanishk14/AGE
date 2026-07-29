# ADR-0043: First Runtime Caller for Scored BIF Capture

- **Status:** Proposed
- **Date:** 2026-07-29
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

The CLI reads `DATABASE_URL`, constructs `new PrismaClient(...)`, wraps it per the existing
`@age/scored-bif-snapshot-persistence` layering — `PrismaScoredBifSnapshotRepository` →
`ScoredBifSnapshotCaptureOrchestrator` → `BusinessDiscoveryScoredBifCaptureOrchestrator` — and
disconnects in a `finally`.

It must **not** reach past that layering. `ScoredBifSnapshotCaptureOrchestrator` remains the only
thing that constructs the bound facade (ADR-0036), and the CLI never touches
`ScoredBifSnapshotRepository`, the bound facade, or Prisma models directly.

**The consequence, named up front because it is a stop condition being deliberately crossed:** this is
the first production `@prisma/client` import, so `ci.yml` must run `pnpm --filter @age/persistence
prisma:generate` before `typecheck` and `build`. That is a CI change, and this ADR is the
authorization for that specific change and nothing else. `prisma generate` needs no database — only
the schema — so `ci.yml` stays DB-free and `ci-db.yml` is untouched.

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

### D8 — Testing: unit-test the CLI's own logic; exercise the real path in `ci-db.yml`

The CLI's argument parsing, validation, exit codes and outcome reporting are ordinary pure logic and
get ordinary tests in the DB-free suite, with an injected fake orchestrator.

The end-to-end path — real `PrismaClient`, real Postgres, real RLS — belongs in `ci-db.yml` as a
`*.db.spec.ts`, following ADR-0032 D13: it must **fail loudly when `DATABASE_URL` is absent, never
`describe.skip`.** It must connect as the **non-owner `age_app` role** and assert that role's own
attributes first, per ADR-0033 D10 — a suite that passes as the owner is a failed suite, because the
owner bypasses RLS.

---

## 3. What acceptance does and does not authorize

**Authorizes exactly one implementation slice:** a new `apps/capture` CLI with the composition root
described in D6, the input handling in D3/D4, the impure values in D5, the mode handling in D7, its
own unit tests, one live `*.db.spec.ts`, and the single `prisma generate` step added to `ci.yml`.

**Does not authorize:** any HTTP endpoint or Web change · authentication or request-derived tenancy ·
any change to `apps/api`, `apps/web`, `apps/demo` or `packages/demo-runtime` · any change to the
schema, migrations, RLS policies, grants or roles · any change to `ci-db.yml` beyond adding the new
spec · reads of persisted snapshots · `Draft → Active` promotion · capability invocation · retention
or erasure · any change to the produce-side chain or the capture packages themselves.

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
3. **Should the CLI refuse to capture a context below some confidence threshold?** The sample fixture
   scores 17. Capturing a low-confidence snapshot is not obviously wrong — a snapshot records what was
   known, and ADR-0025 is explicit that absence is never a conclusion — but nobody has decided whether
   a quality gate belongs here. Defaulting to "capture whatever was produced" is the recommendation,
   and it is a decision, not an absence of one.
4. **Is a single-shot CLI the right shape at all,** versus a batch or watched-directory ingest? D2
   picks the smallest thing that runs; it does not claim it is the right long-term ingest design.
