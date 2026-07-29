# ADR-0044: The Snapshot Read Path — Consumer Decision and the Version-Gate Defect

- **Status:** Accepted
- **Date:** 2026-07-30
- **Accepted:** 2026-07-30 (decision delegated to the architect by the user; see §0.2)
- **Supersedes:** none
- **Amends:** none. It **answers** ADR-0043 open question 5 and **corrects** two factual claims in
  `docs/reviews/ADR0043_SNAPSHOT_CONSUMER_OPTIONS.md`.
- **Related:** ADR-0026/0027 (capability context consumption and readiness), ADR-0030 (snapshot
  identity and lifecycle), ADR-0031 (durable persistence), ADR-0032 (migration convention and live DB
  testing), ADR-0033 (RLS policy), ADR-0041 (snapshot context JSON type), ADR-0043 (first runtime
  caller; D10 and open question 5)

---

## 0. How this decision was reached

### 0.1 A four-lens council, and what it overturned

ADR-0043 D10 recorded that "what consumes a snapshot series, and for what" is the next real decision,
that it is a **product** decision, and that it "should not be answered by whoever happens to write the
next slice." An options report (`docs/reviews/ADR0043_SNAPSHOT_CONSUMER_OPTIONS.md`, PR #152) set out
four options: **A** a trend/history reader over `listSeries`, **B** capability readiness computed over
a persisted context, **C** operational read-back only, **D** record that no consumer is justified yet.

A council of four deliberately different lenses then reviewed it against the code: long-term
architecture, an adversarial skeptic briefed to argue for D, security-and-invariants, and
sequencing-and-delivery. **The council overturned the options report's central factual claim and
found a defect nobody was looking for.** Both are recorded below because the report is now merged and
would otherwise be cited as support for a conclusion its own evidence does not carry.

**Dissent is recorded in §5.** The council did not agree, and the disagreement is load-bearing.

⚠️ **One council member's output must be discounted on one point.** The sequencing lens read the
options report and repeated its false RLS claim back as if independently established. The three
lenses that checked the code directly all contradict it. This is itself a finding: a reviewer given a
document as context will launder that document's errors back to the author as confirmation.

### 0.2 How this was accepted

Standing governance is that a `Status: Proposed` ADR is a decision request and is never self-accepted.
ADR-0043 §0.1 was the documented exception and stated that the exception "does not generalize."

**The user has since delegated again, more broadly and unprompted**, in these words:

> "i told you to act as an architect and take descision that makes the software robust and perform for
> whats it intended. incase of complex issue deploy council to make decision. and also keep creating
> session handover document at important checkpoint so we dont loose track and you continusoy work
> without stopping for asking me question."

This is a standing grant, not a one-off: it names the mechanism (council), the standard (robust
software that performs as intended), and the mode (continuous work without stopping to ask). The
council in §0.1 was convened under it.

**The acceptance is therefore the architect's, exercised under a stated grant of authority — it is not
a claim that the user reviewed these decisions individually.** Anyone revisiting this ADR should weigh
it on the technical reasoning and the recorded council dissent, not on user ratification of details.

---

## 1. Two corrections to the record

### C1 — The SELECT RLS policy is already proven through the production adapter. **The options report says otherwise and is wrong.**

`ADR0043_SNAPSHOT_CONSUMER_OPTIONS.md:116-118` claims the SELECT `USING` policy "is exercised today
only by raw-SQL tests and the contract suite, never through the scoped adapter from production code."

**False as of PR #151.** `packages/persistence/src/tests/scored-bif-snapshot-rls.db.spec.ts:73-74`
constructs `new ScopedScoredBifSnapshotRepository(new PrismaScoredBifSnapshotScopeRunner(app))` — the
production adapter over the production runner, against the non-owner `age_app` connection — and drives
all three reads through it: `findBySnapshotId` (`:257`, `:321`, `:396`), `listSeries` (`:269`, `:323`,
`:397`), `findLatest` (`:270`, `:326`, `:405`), covering the positive case, cross-scope invisibility,
and fail-closed behaviour under a missing GUC.

Slice A closed the read-side proof as a side effect of closing the write-side one, because `inScope`
(`scoped-scored-bif-snapshot-repository.ts:60-68`) is shared by all four operations. **Option C's
stated justification is therefore dead**, and so is observation 3 of the report's §3.

What remains genuinely unproven is far narrower: two _independently_ scoped adapters, each querying
with its own honest key, where the tenants share an `organizationId` or `bifId`. Today's adapter-level
cross-tenant tests use a borrowed-foreign-key pattern, which the spec documents at `:292-310` as a
deliberate conflation of "wrong key" with "wrong scope". That shape is proven only in raw SQL.

### C2 — ADR-0027's constraint is about item **content**, not emptiness.

The report at `:99` and the project handover both stated that `output.items` "stays permanently
empty." **False.** `packages/capabilities/intelligence/src/processing/assess-scored-bif-context.ts:285`
builds `BusinessContextSupportItem[]` and returns them at `:333`.

The actual rule (ADR-0027, lines 90-91) is that an assessment "**must not** derive, rank, score,
shortlist, name or hint at any plan, opportunity, action or recommendation, **in items or in summary
text**", with non-gating stated separately at lines 88-89 and 97.

This matters beyond pedantry: **a future slice that checks "is `items` empty?" would pass while the
real invariant is broken.** Guard content, never length.

---

## 2. Decisions

### D1 — The consumer answer is **D**: no production consumer is authorized yet. **A is named as the destination.**

No production read path is authorized by this ADR. The reasoning is that only **history** is a
property recomputation cannot supply — decoupling is not real while producer and consumer share a
process, and cost is not an argument at all, since the produce chain is pure and in-memory. History is
therefore the only honest destination, and history does not exist: there are zero production writers
and zero rows.

**A (a trend/history reader over `listSeries`) is recorded as the intended destination.** It is not
authorized for build. The contracts package already asserts why, at
`scored-bif-snapshot-repository.ts:23-29` — "Score history is the reason to persist a confidence score
at all" — and `scored-bif-snapshot.ts:38-40` says determinism exists so that "has this scored BIF
changed?" is "a question with an answer." Today that question has an answer and no asker.

### D2 — **Reject C.** Read-back is not a consumer; it is a postcondition assertion on `append`.

`findBySnapshotId` keyed by the `snapshotId` the writer just minted, in the same process, in the same
run, under a `ClientContext` built from the same two CLI arguments, through a repository that derives
its scope _from that same key_, cannot observe anything the write did not just assert. Read and write
scope are the same value by construction, so read-back **cannot detect the one failure it purports to
guard against** — a wrong `--client-id`.

Recording C as discharging D10 would mark the objection resolved when nothing had been resolved. If a
read-back affordance is ever wanted, it belongs inside the capture CLI's exit-code logic as **writer**
code, and must not be described as a consumer or as an RLS proof.

### D3 — **Reject B.** Readiness over a persisted context is redundant today and smuggles a temporal decision.

The readiness assessors take a `ScoredBifContext`; the produce chain already hands them one in memory.
Reading the same object out of Postgres to feed the same function is a longer path to an identical
result. B becomes non-redundant only once producer and consumer are separate processes — a future this
ADR does not authorize.

Two further reasons, both found by the council and neither in the options report:

- **B depends on Slice B anyway.** The assessors require a caller-supplied `producedAt`
  (`assess-scored-bif-context.ts:236-241`: "this flow never reads the wall clock"). Per ADR-0043 D5 a
  clock owner exists only in an entry point that has not been built.
- **B silently introduces a staleness question the repo has never decided.** Readiness computed from a
  stored context is readiness _as of `capturedAt`_, not as of now, and nothing in `CapabilityOutput`
  says which. That is a semantics decision, and it must not arrive disguised as a wiring slice.

The ADR-0027 slippery-slope concern raised in the options report is judged **overblown** — the
separate-entry-point rule and the regex scan enforce the boundary, and swapping a recomputed context
for a decoded one does not touch it. B is rejected on redundancy and smuggled semantics, not on that
hazard. Correcting an overstated objection is part of the record.

### D4 — **The version-gate bypass on the read path is a defect and is authorized for immediate repair.**

This is the council's most consequential finding and is **independent of the consumer decision**.

`fromScoredBifSnapshot` enforces a major-version gate (`scored-bif-snapshot.ts:232-238`): it refuses to
read a `snapshotVersion` whose major differs from `SCORED_BIF_SNAPSHOT_VERSION`, because a reader that
proceeds is "inventing the meaning of fields it has never seen."

**The read path does not go through it.** `fromScoredBifSnapshotRow`
(`scored-bif-snapshot-row.ts:116-128`) routes through `normalizeScoredBifSnapshotRecord`, which
validates `snapshotVersion` as bare `z.string()` (`scored-bif-snapshot.ts:63`) and never checks the
major. A row written under a future `2.x` will be read back, validated, and handed to a consumer with
the gate silently bypassed.

On an append-only table that **can never be migrated in place**, this is the most durability-relevant
defect in the read path. Under D it would otherwise stay latent until the first version bump — which
is exactly when it is most expensive to discover.

**Authorized:** enforce the major-version gate on the read path, in
`@age/business-discovery-contracts`, with unit tests proving a `2.0.0` row is rejected and a `1.x` row
is accepted. Pure, no I/O, no schema change, no migration, no new dependency.

### D5 — Record `listSeries` as the over-built member, and its unbounded signature as a known future cost.

The options report argued the _schema_ is over-built without a series reader. **That over-claims**, and
the correction matters. The absent `updatedAt`/`version`/`deletedAt`/`current` columns are a write-side
integrity decision (`schema.prisma:24-30`); the composite PK is required by the RLS predicate and by
append idempotence; text `capturedAt` is justified primarily by byte-identical round-tripping, with
lexicographic ordering a consequence. All earn their keep with zero readers. The index's `DESC` tail is
shaped for `findLatest`'s `take: 1`, not for a series scan.

**It is the port, not the schema, that is over-built.** `listSeries`
(`scored-bif-snapshot-repository.ts:187`) has no justification other than a history consumer. If A
never arrives, `listSeries` is the dead weight, and this ADR says so out loud rather than leaving it
implied.

Recorded as a known cost, not authorized for repair: `listSeries` returns an entire series as a
`ReadonlyArray` with **no limit, cursor or projection**, each element carrying a full `ScoredBifContext`
jsonb payload. The first real consumer over a client with hundreds of snapshots will want pagination,
and adding it later means changing the port, four adapters and the shared contract suite at once.
**Do not "fix" this speculatively** — a pagination design with no consumer would be guessing at the
access pattern. It is recorded so the cost is chosen, not stumbled into.

### D6 — Record that the series is an **operator-asserted chronology**, not an observed one.

The projection is `Date`-free and the ordering is entirely `capturedAt`, which is caller-supplied —
ADR-0043 D5 even authorizes a `--captured-at` override. Any future A implementation must state this in
its own ADR and must bound its claims accordingly: it may report that a stored series _records_ a
change, never that a change _happened_ at a time the system observed.

### D7 — ADR-0043 Slice B is unblocked and should proceed.

Slice B was deferred pending this decision. The decision is now made: A is the destination, A requires
repeated captures of one BIF, and repeated captures require a writer. Slice B is therefore the
prerequisite for the only destination worth having, and it is **already authorized** by ADR-0043 D9 —
this ADR adds no new authority, it merely removes the reason for the pause.

**The council's dissent on this point is real and recorded in §5.**

---

## 3. What this ADR authorizes and does not

**Authorizes:** exactly one code change — the read-path major-version gate of D4, in
`@age/business-discovery-contracts`, with its unit tests. Plus the corrections to the record in §1.

**Explicitly does NOT authorize:** any production read path or reader surface · Option A, B or C in any
form · pagination or any change to `listSeries`'s signature · any HTTP, Web, API or demo change · any
schema, migration, RLS, grant or role change · capability invocation · `Draft → Active` promotion ·
retention or erasure · any change to the produce-side chain · any change to ADR-0043's Slice B scope.

**The demo baseline must stay byte-identical:** 6 capabilities, 6 pending approvals, accounting
invariant OK, 7 populated and 5 omitted sections.

---

## 4. The revisit trigger for D1

D deferred indefinitely is D10 by neglect. The trigger is therefore concrete and falsifiable:

> **Revisit the consumer decision when a production writer has run against a real database and
> produced at least two snapshots for one `(clientId, organizationId, bifId)`.**

At that moment A has real input, its ordering assumptions can be tested against rows nobody wrote in a
fixture, and the pagination cost of D5 becomes measurable rather than hypothetical. Until then, any
reader is scaffolding built on scaffolding.

---

## 5. Recorded dissent

A council that produced no dissent was not a council. These positions were argued, are not adopted,
and are preserved so a later reader can weigh them directly.

**The architecture lens ranked A first, not D.** Its argument: A's durable half is guaranteed to
survive a CLI→HTTP replacement if split correctly — the trend/diff computation is a pure function over
`ReadonlyArray<ScoredBifSnapshotRecord>` belonging in `@age/business-discovery-contracts` beside the
codec, with only the fetch living at a composition root. That is the same shape that made Slice A the
right first build. **This ADR rejects A now on input, not on design** — the split is endorsed and
should be adopted verbatim when A is built. Its own self-criticism is why: "choosing A today authorizes
a chain in which the only thing that will actually run is a hand-invoked CLI writing operator-asserted
timestamps into a table so that a reader can later report the trend of a series the same operator
manufactured. That is a closed loop with no external observer in it."

**The skeptic lens argued D7 is wrong — that Slice B should not proceed either.** Its argument: choosing
any reader or writer now means authorizing a second production entry point for a subsystem whose first
does not exist, and the operator-trust residual (ADR-0043 D4, open question 2 — no client registry, no
tenant table, no ADR-0009 `Client` implementation) means neither reader nor writer can be handed a
legitimate scope id. It further observed that a mis-typed **read** returns `[]`/`null`, which under
`FORCE ROW LEVEL SECURITY` is indistinguishable from "there is no data" — a silent false negative the
write path does not have. **This ADR accepts the observation and rejects the conclusion:** the silent
read failure is a reason to gate readers (which D1 does), not a reason to stop the writer that ADR-0043
already authorized. The operator-trust residual is real, unresolved, and remains recorded.

**The security lens found the read-side asymmetry that most constrains any future A.** A write-side
scope bug is _visible_ — rejected by `WITH CHECK`, or it writes attributable garbage. A read-side scope
bug under an honestly-scoped-but-wrong identity is **silent**: no policy violation at all, just another
tenant's business intelligence returned. The database guarantees "no transaction sees data outside the
scope it declares," never "the scope is honest." **Consequence for any future reader ADR:** the reader
question and the `ClientContext`-source question (ADR-0043 open question 2) are **not separable**, and a
reader ADR that does not resolve the scope-source question is incomplete. It also recommended a live
spec closing the narrow gap in §1 C1 (two independently scoped adapters, honest keys, shared
`organizationId`/`bifId`). That is **not authorized here** — it is a read-path test, and D1 gates read
work — but it is recorded as the first thing any future read ADR should include.

**The sequencing lens recommended C now with A as destination.** Discounted: its case rested on the
false premise corrected in §1 C1, which it inherited from the options report rather than from the code.
Its delivery analysis is sound and is adopted separately — in particular that a live spec placed under
`apps/capture` would be collected by **nothing at all**, since
`packages/persistence/vitest.db.config.ts` includes only `src/**/*.db.spec.ts` relative to that package.
A `ci-db.yml` `paths:` addition makes the workflow _trigger_; it does not make such a spec _run_. Slice B
must therefore host its live spec in `packages/persistence`, and must prove the spec's names appear in
the CI log — green is a job that executed its steps.
