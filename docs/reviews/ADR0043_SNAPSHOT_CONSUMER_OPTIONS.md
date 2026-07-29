# ADR-0043 Open Question 5 — What Consumes a Snapshot Series? (Options Report)

- **Date:** 2026-07-30
- **Status:** Options report — **no decision is made here.** This exists so the decision is taken
  deliberately rather than by whoever writes the next slice.
- **Raised by:** ADR-0043 D10 and open question 5, which state verbatim that the question
  "what consumes a snapshot series, and for what" is _"the next real decision after this one, and it
  is a product decision, not an implementation one."_
- **Related:** ADR-0030/0031 (snapshot identity, durable persistence), ADR-0026/0027 (capability
  context consumption and readiness), ADR-0033 (RLS), ADR-0043 (first runtime caller)

---

## 0. Why this report exists now

ADR-0043 Slice A is merged and green (PR #151). Slice B — the composition root and the `apps/capture`
CLI — is authorized but **deliberately deferred**, because ADR-0043 open question 1 concedes the CLI
may be scaffolding, and because the reader decision determines whether a single-shot CLI is the right
first caller at all.

Slice A was the right thing to build regardless of the answer here: it is required by every possible
caller and discarded by none. Slice B is not in that category. Deciding the consumer first means we
learn whether the first production entry point should be a writer, a reader, or both at once.

---

## 1. Verified state of the read path (evidence, 2026-07-30, `main` @ `30060e9`)

**The three read operations have zero non-test production callers.** A repo-wide search for
`findBySnapshotId`, `listSeries` and `findLatest` across `packages/` and `apps/`, excluding
`*.spec.ts`, returns only:

- the port declaration — `packages/business-discovery-contracts/src/scored-bif-snapshot-repository.ts`
  (lines 180, 187, 197);
- four adapter implementations — the in-memory adapter, `PrismaScoredBifSnapshotRepository`,
  `ScopedScoredBifSnapshotRepository`, and the `ClientContextBound…` facade;
- the shared contract suite `src/tests/scored-bif-snapshot-repository-contract.ts` (test
  infrastructure, not a caller);
- stale `dist/` declaration files.

Nothing consumes a stored snapshot. This confirms D10 as written, on current evidence.

**But a consumer _shape_ already exists.** Three capabilities have context-readiness entry points
that accept a `ScoredBifContext`:

| Capability       | Readiness module                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------ |
| Intelligence     | `packages/capabilities/intelligence/src/processing/assess-scored-bif-context.ts`           |
| Market Discovery | `packages/capabilities/market-discovery/src/processing/assess-market-context-readiness.ts` |
| Revenue          | `packages/capabilities/revenue/src/processing/assess-revenue-context-readiness.ts`         |

`fromScoredBifSnapshot` decodes a stored snapshot to exactly a `ScoredBifContext`. So the type-level
join between "what is stored" and "what something already reads" is **already closed** — what is
missing is a reason to read the _stored_ one rather than the freshly produced one.

**That last sentence is the whole question.** The produce side has a live caller
(`packages/demo-runtime/src/business-discovery.ts:94` calls `produceScoredBifContext`, reached by
`pnpm demo`), and it produces a context in memory without touching the database. Any consumer
proposal must answer: _what does reading a persisted snapshot give us that recomputing does not?_

There are only three honest answers, and each maps to a different option below: **history**
(recomputation cannot recover a past state), **decoupling** (the reader runs at a different time or
in a different process from the producer), or **cost** (recomputation is expensive). Cost is not
currently a real argument — the produce chain is pure, in-memory and fast.

---

## 2. The options

Each option states what it would authorize, what it proves, what it costs, and what it forecloses.
None of them is recommended by fiat; §3 gives my reasoning, but the choice is the user's.

### Option A — Trend/history reader: `listSeries` over time

**What it is.** A read path that returns the ordered snapshot series for a BIF, so that change in
scores over time is observable: "confidence went 17 → 34 after the second discovery round."

**What it proves.** That the append-only design earns its keep. This is the _only_ option that uses a
property recomputation cannot supply — a past state. The schema was built for this: the index is
`(client, org, bif, capturedAt DESC, snapshotId DESC)`, `capturedAt` is text precisely so
lexicographic ordering equals chronological ordering, and there is deliberately no `updatedAt`,
`version`, `deletedAt` or `current` column.

**Cost / risk.** Needs at least two snapshots of the same BIF to be meaningful, which means it is only
useful _after_ a writer exists and has run more than once. So it does not remove the need for Slice B;
it reorders it at best, and more likely sequences after it.

**Forecloses.** Nothing. A series reader is compatible with every later consumer.

### Option B — Capability readiness over a persisted context

**What it is.** Feed a snapshot decoded via `fromScoredBifSnapshot` into the three existing readiness
assessors, so readiness is reported against the stored context rather than a recomputed one.

**What it proves.** That persistence serves the capability layer — the system's actual purpose —
rather than serving only itself.

**Cost / risk.** ⚠️ **This is the option with a real hazard.** ADR-0027's central constraint is that
context readiness is **never a gate on `run`**, `output.items` stays permanently empty, and no plan,
opportunity, action or recommendation may be derived, ranked, named or hinted at. A stored-context
reader sits uncomfortably close to that line: the natural next request after "report readiness from
the database" is "so act on it." Choosing B means committing, in the ADR, that it does not move the
gate. Also, today it buys nothing over passing the freshly produced context directly — the decoupling
argument only becomes real once producer and consumer are separate processes.

**Forecloses.** Nothing structurally, but it spends the readiness pattern's remaining headroom on a
case that does not yet need persistence.

### Option C — Operational read-back / verification only

**What it is.** The narrowest possible reader: `findBySnapshotId` and `findLatest` exposed to an
operator, purely to confirm that a capture landed and to inspect what was stored. No product surface,
no capability involvement.

**What it proves.** That the RLS read policy works through the production adapter as the non-owner
`age_app` role — the read-side twin of what Slice A proved for writes. That is a genuine, currently
unproven guarantee: the SELECT `USING` policy is exercised today only by raw-SQL tests and the
contract suite, never through the scoped adapter from production code.

**Cost / risk.** Smallest of the three. But it is close to being _part of_ the capture caller rather
than a consumer in its own right — it answers "did my write work," not "what is this data for." It
does not discharge D10; it only makes the write path self-verifying.

**Forecloses.** Nothing.

### Option D — Decide the consumer is genuinely not needed yet, and say so

**What it is.** Record that no consumer is justified on current evidence, and that snapshots exist as
an audit/append log whose value is realized later. Build Slice B (or not) with the write-path-with-
no-reader cost accepted explicitly and durably, rather than left as a standing objection.

**What it proves.** Honesty. It is a legitimate answer, and it is the answer the evidence most
directly supports: nothing in the repo currently _wants_ a stored snapshot.

**Cost / risk.** The system accumulates write-only machinery. If this is chosen, it should be chosen
once, in an ADR, with a stated trigger for revisiting — not re-litigated each slice.

**Forecloses.** Nothing, but it leaves D10 permanently open by design rather than by neglect.

---

## 3. Reading of the evidence (not a decision)

Three observations I would want weighed:

1. **Only Option A uses a property recomputation cannot supply.** History is the sole capability the
   persisted form has that the in-memory produce chain does not. If snapshots are not eventually read
   as a _series_, the append-only schema — no `updatedAt`, no `current`, text `capturedAt` for
   lexicographic ordering — is over-built for its use.
2. **Option A cannot come first in build order.** A trend reader needs multiple captures of one BIF,
   which needs a writer that has run repeatedly. So "A is the destination" and "B must be built
   before A is useful" are both true; that is an argument for building Slice B _toward_ A, not an
   argument against A.
3. **Option C is the cheapest real proof and is nearly free if bundled with Slice B.** It closes the
   one remaining unproven RLS guarantee (SELECT through the scoped adapter as `age_app`) and needs no
   product decision at all. It is arguably not a "consumer" answer but a completeness item.

The combination that fits the evidence best is **C as a scope addition to Slice B, with A named as the
intended destination in a new ADR, and B deferred no longer once that destination is on record.**
That is a proposal, not a decision. Option B carries the ADR-0027 hazard and I would not choose it
without an explicit restatement that readiness never gates `run`. Option D is defensible and should
be chosen deliberately if the honest answer is that no product consumer is coming soon.

---

## 4. What happens next, per option

| If the answer is                  | Then the next artifact is                                                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| A (trend reader)                  | A `Status: Proposed` ADR-0044 defining the series read path, its scope handling, and its relationship to Slice B's ordering                    |
| B (readiness over stored context) | A `Status: Proposed` ADR-0044 that must restate ADR-0027's non-gating constraint explicitly                                                    |
| C (operational read-back)         | A `Status: Proposed` ADR-0044, or an amendment extending ADR-0043 Slice B's authorized scope — ADR-0043 currently does **not** authorize reads |
| D (no consumer yet)               | A `Status: Proposed` ADR-0044 recording the decision and its revisit trigger, so D10 stops being a standing objection                          |

In every case the next step is a **`Status: Proposed` ADR — a decision request, never self-accepted.**
Note that ADR-0043 explicitly does not authorize "reads of persisted snapshots," so **no read work of
any kind may begin under the current authorization**, including Option C.

---

## 5. Boundary confirmation

This document changes no code, no schema, no workflow and no ADR status. Nothing in `packages/`,
`apps/` or `.github/` is touched. It is a review note under the standing rule that a product
judgement produces an options report rather than a guess.
