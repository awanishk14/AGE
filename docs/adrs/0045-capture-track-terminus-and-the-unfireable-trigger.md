# ADR-0045: The Capture Track's Authorized Terminus, and a Revisit Trigger That Cannot Fire

- **Status:** Accepted
- **Date:** 2026-07-30
- **Accepted:** 2026-07-30 (decision delegated to the architect by the user; see §0.2)
- **Supersedes:** none
- **Amends:** **ADR-0044 §4** (narrows the D1 revisit trigger). Corrects one factual claim in ADR-0044
  §4's premise and one misleading test name introduced by ADR-0043 Slice B2.
- **Related:** ADR-0029/0030 (snapshot identity and lifecycle), ADR-0032 (migration convention and
  live DB testing), ADR-0033 (RLS policy), ADR-0043 (first runtime caller; D4, D10, open questions 1/2/4),
  ADR-0044 (snapshot read path and consumer; D1, D5, D6, §1 C1, §4, §5)

---

## 0. How this decision was reached

### 0.1 A four-lens council, and the recommendation it talked me out of

The question put to the council was deliberately narrow and factual: **has ADR-0044 §4's revisit
trigger fired, and what is the right next decision on this track?** Four lenses were convened —
long-term architecture, an adversarial skeptic briefed to authorize nothing, security-and-invariants,
and test-integrity-and-CI-execution.

Per ADR-0044 §0.1's council-reliability finding, **every lens was given the code and the ADRs, and none
was given my prose.** That mattered: the lenses disagreed with each other and two of them disagreed
with my own framing, which is the behaviour the finding predicts when prose is withheld.

**The council's majority recommendation was rejected.** Two lenses (security-and-invariants,
test-integrity) independently recommended adding a live spec that runs the capture CLI twice for one
`(clientId, organizationId, bifId)` with two distinct minted `snapshotId`s, thereby producing a
two-member series and firing §4's trigger. The security lens went further and said the resulting PR
"must be treated and reported as the trigger firing."

That recommendation is **rejected in D3**, for the reason the other two lenses gave and which both
recommending lenses raised against themselves: it satisfies §4's sentence while destroying §4's
purpose. Notably, the factual work of the two recommending lenses was the strongest in the council —
the RLS superuser-bypass analysis and the vitest-glob-collection analysis below are both theirs. **A
lens can be right about every fact and wrong about what to do with them**, and this is now the second
recorded instance on this track of a reviewer's conclusion needing to be discounted while its evidence
is adopted (the first is ADR-0044 §0.1).

**Dissent is recorded in §5.** The council did not agree, and the disagreement is load-bearing.

### 0.2 How this was accepted

Standing governance is that a `Status: Proposed` ADR is a decision request and is never self-accepted.
This ADR is self-accepted under the standing grant the user gave, unprompted, in these words:

> "i told you to act as an architect and take descision that makes the software robust and perform for
> whats it intended. incase of complex issue deploy council to make decision. and also keep creating
> session handover document at important checkpoint so we dont loose track and you continusoy work
> without stopping for asking me question."

**The acceptance is therefore the architect's, exercised under a stated grant of authority — it is not
a claim that the user reviewed these decisions individually.** Weigh this ADR on its technical
reasoning and its recorded dissent, not on user ratification.

⚠️ **One part of this ADR is deliberately NOT decided under that grant.** D6 refers ADR-0043 open
question 2 — the source of a legitimate `clientId`/`organizationId` — to the user as a **product**
decision. The grant covers architectural decisions; "who is a client, and who may write on their
behalf" is not one. This is the ADR-0044 §5 non-separability finding taken at its word, and it is the
one case CLAUDE.md §2 item 5 reserves for stopping.

---

## 1. Corrections to the record

### C1 — A live two-member series for one identity **already exists**. ADR-0044 §4's premise, and this project's handover, both understated it.

The handover stated that PR #156 produced "only one snapshot per identity." ADR-0044 §4 was worded as
though a two-member series had never been written to a real database at all. **Both are wrong**, and
the correction changes why the trigger is unfired:

- `packages/persistence/src/tests/scored-bif-snapshot.db.spec.ts:440-442` appends `snap-1`, `snap-2`
  and `snap-3` under one identity against live PostgreSQL.
- `:386-404` proves `listSeries` ordering is derived from `capturedAt` as PostgreSQL orders it and
  **not** from insertion order — inserting middle, newest, oldest and asserting
  `['snap-a', 'snap-b', 'snap-c']`.
- `:406-419` proves the `capturedAt` tie is broken by `snapshotId` in PostgreSQL's collation.
- `packages/persistence/src/tests/scored-bif-snapshot-rls.db.spec.ts:261-271` proves a two-member
  series accumulates and that `listSeries`/`findLatest` return rows **through the production
  `ScopedScoredBifSnapshotRepository` over the production `PrismaScoredBifSnapshotScopeRunner`**, as
  the non-owner `age_app` role under `FORCE ROW LEVEL SECURITY`.

So the multi-member series — its storage, its ordering, its tie-break and its `findLatest` — is **not
an untested shape**. The trigger is unfired for a much narrower reason, stated in D1: those rows were
written by the **repository adapter**, not by the **capture writer**.

This correction is what collapses the case for the spec the council majority recommended. Its author
would have been building a second proof of an already-proven property, in order to fire a trigger.

### C2 — The live test named "refuses a second write under the same identity" invites a false inference about production.

`packages/persistence/src/tests/capture-cli.db.spec.ts:146-158` runs the capture CLI twice and asserts
the second run exits `captureFailed` and leaves one row. Its comment says "The primary key IS the
logical identity (ADR-0030)."

Both are true, and together they read as "a series cannot grow." **Production does the opposite.** The
refusal happens only because the spec's injected runtime pins `newSnapshotId: () => 'snap-minted'`
(`:69`), so the second run reuses all four primary-key components. Production mints
`randomUUID()` (`apps/capture/src/main.ts:32`), so a real second run under the same three-part series
key produces a **distinct** `snapshotId` and **succeeds**, appending a second snapshot.

The test proves **append idempotence under a pinned `snapshotId`**. It does not prove, and must not be
read as proving, anything about repeated capture. This is the ADR-0044 C2 defect class exactly — a
test that passes while a reader takes away the opposite of the real invariant — and D4 authorizes its
repair.

### C3 — `apps/capture` has never executed. Anywhere.

`age-capture` is invoked by no workflow, no package script and no other package: `apps/capture` appears
in `.github/` only as a `paths:` filter (`.github/workflows/ci-db.yml:23`, `:30`), and `main.ts` has
**zero importers repo-wide**. The live spec supplies its own `CaptureRuntime` (`capture-cli.db.spec.ts:68-74`)
and imports `runCapture` and `openPrismaCaptureConnection` directly, so the `runtime` literal at
`main.ts:29-38` — the real clock, the real id source, the real `readFileSync` — is on no execution path
at all.

The handover's claim that #156 gave capture "a runtime caller" is therefore true only in the sense that
a caller now **exists in source**. Nothing has ever called it. This is not a defect — a CLI is meant to
be run by an operator, and there is no operator — but it is the fact that makes §4's trigger
un-fireable, and it was not recorded.

---

## 2. Decisions

### D1 — ADR-0044 §4's revisit trigger has **NOT** fired. The reason is the writer, not the row count.

All four lenses agree. Given C1, the precise reason is narrow: every live two-member series in the repo
is written by `repository.append(...)` directly. None goes through the capture writer — no
`ScoredBifSnapshotCaptureOrchestrator`, no `BusinessDiscoveryScoredBifCaptureOrchestrator`, no
`runCapture`. §4 says "a production **writer** has run," and ADR-0043 D6 defines the writer as the
capture chain, not the adapter at its base.

**Do not read PR #156 as firing the trigger, and do not read C1 as firing it either.** What #156
changed is that firing it became _possible in principle_. D2 explains why it is still not possible in
practice.

### D2 — The trigger is **un-fireable by this repository**, by construction. §4 is narrowed to say so out loud.

This is the finding that reframes the whole track, and no one had stated it.

§4's trigger requires a production writer run. A production writer run requires the three things the
test suite must replace in order to be a test: a real clock, a real id source, and an operator who
chose the scope. `capture-cli.db.spec.ts` pins all three (`now: () => INSTANT` at `:70`,
`newSnapshotId: () => 'snap-minted'` at `:69`, hardcoded `ARGS` at `:48-59`) and `TRUNCATE`s between
tests (`:99`). CI has no operator and no wall clock it is willing to trust. Therefore **CI cannot fire
this trigger, and no amount of diligence inside CI can.** Only a human operator running `age-capture`
against a real database can.

**§4 is amended to state this explicitly.** The amendment is a **narrowing, never a loosening** — that
distinction is the whole point:

> **Amended §4 trigger.** Revisit the consumer decision when a production writer has run against a
> real database and produced at least two snapshots for one `(clientId, organizationId, bifId)`.
> **A series authored by this repository's own test suite does not fire this trigger, however
> faithfully it drives the production chain.** The trigger requires rows whose `snapshotId`,
> `capturedAt` and scope were chosen outside the repository — by an operator and a real clock — because
> its entire function is to supply information the decision does not already have. Evidence authored by
> the party the evidence unblocks is not evidence.

Amending a trigger **before** anyone satisfies its letter is worth far more than amending it after, and
the council demonstrated the hazard is live: half of it recommended satisfying the letter within minutes
of reading the code.

### D3 — **Reject** the council majority's two-capture live spec, as trigger evidence **and** as coverage.

Rejected on two independent grounds, either sufficient:

1. **As trigger evidence it is self-confirming.** Every property of the series would be chosen by the
   author who benefits from the trigger firing: two ids I pick, two instants I pick, one fixture I
   pick. ADR-0044 D6 already records the chronology as _operator-asserted_; in a spec the asserting
   operator **is** the test author, so the series would be self-asserted and then read back as proof.
   ADR-0044 §5's architecture lens named this shape in advance — "a closed loop with no external
   observer in it" — and a spec is a _tighter_ loop than a hand-invoked CLI, because in the CLI at
   least the operator and the clock are exogenous.
2. **As coverage it is nearly empty, per C1.** Series storage, ordering, tie-break and `findLatest` are
   already live-proven, twice, one of those times through the production scoped repository as
   `age_app`. The only genuinely new fact would be "the capture chain, entered twice with distinct
   ids, appends twice instead of colliding" — and the _interesting_ half of that (that a pinned
   duplicate is refused rather than overwritten) is already proven at `capture-cli.db.spec.ts:146-158`.

There is also a third, weaker ground worth stating because it was tempting: the two rows would carry
**byte-identical `context` payloads**, since both come from `SAMPLE_BUSINESS_DISCOVERY_PROFILE` under
one `BIF_CONFIDENCE_SCORING_VERSION`. A trend reader over that series could only ever report "no
change" — so it could not exercise the single question Option A exists to answer.

**If such a spec is ever wanted, it must be written as part of the D1-revisit ADR's own slice**, so the
trigger-firing and the decision-making are one reviewed unit of work, never a trigger pulled quietly by
a PR that presents itself as "just a test."

### D4 — **Authorized:** repair the misleading test name and comment of C2. Prose only, no behaviour change.

The one code change this ADR authorizes. In
`packages/persistence/src/tests/capture-cli.db.spec.ts:146-158`: rename the test so it names what it
actually proves — append idempotence **under a pinned `snapshotId`** — and extend its comment to state
explicitly that production's `randomUUID()` means a real second run **appends** a second snapshot rather
than being refused.

No assertion changes, no new test, no new surface, no new dependency. It cannot fire any trigger,
because it adds no row to any series. It is authorized because a test whose name teaches the opposite of
production behaviour is a live hazard on an append-only table, and ADR-0044 C2 established that this
repo repairs that class of defect on sight rather than filing it.

**Explicitly NOT authorized here:** adding a second-capture test (D3), and wiring `main.ts` into any
CI or script path (D5).

### D5 — Record that `main.ts` is untested and unexecuted (C3). Do **not** fix either.

Two related residuals, both recorded, neither authorized:

- `main.ts` invokes itself at module top level (`:53`), so importing it in a spec would immediately run
  `runCapture` against the real `process.argv`, the real filesystem and the real clock. It is therefore
  **untestable by import**, and its exit-code mapping (`:54-56`) and unexpected-throw handler
  (`:57-63`) have **zero coverage**.
- Nothing anywhere executes it (C3).

Both are consequences of a deliberate design — `main.ts` owns every effect precisely so that everything
above it is pure and testable, and `capture-runner.ts:22-24` argues the remainder is "a transcription so
short that reading it is a sufficient review." That argument is sound and this ADR does not overturn it.

It is recorded because the argument has a cost that was never written down: **the repo's purity
guarantee is strong and its entry-point guarantee is untested**, and the untested part is the part that
decides what an operator's shell sees. Making it testable means extracting the self-invocation behind an
`import.meta.main`-style guard, which changes the production entry point's shape and belongs to whoever
next has a reason to touch it. Wiring it into CI would be worse: it would either need a real database
and credentials in `ci.yml` (which ADR-0032 keeps DB-free) or it would fire the D2 trigger from inside
the repository, which D2 forbids.

### D6 — The track's authorization set is **empty**, and the real blocker is a **product** decision. Referred to the user.

ADR-0043's two slices are built, merged and green. ADR-0044's sole authorized change — the D4 read-path
major-version gate — **is already discharged**: `assertReadableSnapshotVersion` exists at
`packages/business-discovery-contracts/src/scored-bif-snapshot.ts:230` and is called from both
`fromScoredBifSnapshot` (`:264`) and the row read path
(`scored-bif-snapshot-repository.ts:245`). After D4 of this ADR lands, **nothing on this track is
authorized and unbuilt.**

Every remaining candidate is gated, and they are not gated on effort:

| Candidate                                                                                    | Gate                                                                                                      |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Option A (trend reader over `listSeries`)                                                    | ADR-0044 D1 withholds authorization; and D2 above says its trigger cannot fire inside this repo           |
| Option B / C                                                                                 | Rejected outright by ADR-0044 D3 / D2                                                                     |
| ADR-0044 §1 C1's narrow gap (two independently scoped adapters, honest keys, shared org/bif) | A **read-path** test; ADR-0044 D1 gates read work                                                         |
| Retiring `listSeries` (ADR-0044 D5's over-built member)                                      | See the rejection below                                                                                   |
| API / Web exposure, client workspace, `Draft → Active` promotion                             | Product decisions, never authorized                                                                       |
| ADR-0043 open question 1 (`ScoredBifContextField.value` is `unknown`)                        | ADR-0041 open question 1 records the conversion as **unremovable**; not a decision, a documented residual |

**The binding constraint is ADR-0043 open question 2: how does an operator obtain a legitimate
`clientId`/`organizationId`?** ADR-0044 §5's security lens established that the reader question and the
scope-source question are **not separable**, and that a reader ADR which skips scope-source is
incomplete. ADR-0043 D4 trusts its operator because there is nothing to validate against — no client
registry, no tenant table, no ADR-0009 `Client` implementation (and PR #26, which would supply one, is
explicitly out of scope).

The trigger gates on **volume of data**; the actual blocker is **legitimacy of scope**. Accumulating
rows of unverified provenance makes the reader decision harder, not easier — and under D2 the repo
cannot accumulate them anyway.

**This is referred to the user as a product decision** (§0.2). It is deliberately not decided under the
architect grant, because "who is a client, and who may write on their behalf" is a business question,
and answering it architecturally would be the same self-authorizing move D3 rejects — one level up.

### D7 — **Reject** retiring `listSeries`, for now.

ADR-0044 D5 named `listSeries` the over-built member of the port, and the skeptic lens offered its
retirement as the one decision that "cannot self-confirm," deletion being immune to manufactured
evidence. That is a genuinely good argument and it is rejected on two narrower ones:

- ADR-0044 D5 says in terms **"do not 'fix' this speculatively."** Deleting the port method is a
  different action from adding pagination to it, but it is the same speculation about an unknown access
  pattern, in the opposite direction.
- Removing a port method touches the port, four adapters and the shared contract suite at once, and is
  **irreversible in a way that waiting is not**. It would also delete live coverage that C1 shows is
  real (`scored-bif-snapshot.db.spec.ts:386-419`).

If Option A is ever formally abandoned rather than merely unauthorized, `listSeries` should go with it,
in that ADR.

---

## 3. What this ADR authorizes and does not

**Authorizes:** exactly one code change — the test-name-and-comment repair of D4, in
`packages/persistence/src/tests/capture-cli.db.spec.ts`. Plus the §1 corrections to the record and the
§4 amendment of ADR-0044's trigger wording.

**Explicitly does NOT authorize:** any second-capture or multi-capture spec (D3) · any production read
path, reader surface or trend computation · Option A, B or C in any form · any change to `listSeries`,
its signature, or its existence (D7) · any change to `main.ts`, including making it testable or wiring
it into CI (D5) · any HTTP, Web, API or demo change · any schema, migration, RLS, grant or role change ·
any new `paths:` entry or workflow change · capability invocation · `Draft → Active` promotion ·
retention or erasure · any change to the produce-side chain · resolving ADR-0043 open question 2 (D6).

**The demo baseline must stay byte-identical:** 6 capabilities, 6 pending approvals, accounting
invariant OK, 7 populated and 5 omitted sections.

---

## 4. The revisit trigger, restated

D2's amended trigger governs the consumer decision. It can be fired only from outside this repository:

> A human operator runs `age-capture --capture --confirm` against a real database, twice, for one
> `(clientId, organizationId, bifId)`, with the real clock and the real `randomUUID()` id source.

Until that happens, ADR-0044 D1 stands, and the honest statement of this track's position is **not**
"waiting for more rows" but "waiting for a decision about who a client is."

**Anti-neglect clause.** ADR-0044 §4 rightly warned that "D deferred indefinitely is D10 by neglect,"
and D2 makes this trigger harder to fire, which sharpens that risk rather than resolving it. The
mitigation is not a looser trigger — it is D6: the blocker has been named, attributed to the right
decision-maker, and surfaced. A blocker that is waiting on a named person is deferred; a blocker nobody
has stated is neglected.

---

## 5. Recorded dissent

A council that produced no dissent was not a council. These positions were argued, are not adopted, and
are preserved so a later reader can weigh them directly.

**The security-and-invariants lens and the test-integrity lens both recommended building the
two-capture live spec** — the position D3 rejects. Their case: no test today runs the _production
composition root_ twice under one identity with distinct minted ids, so "the production CLI accumulates
rather than collides" is genuinely unproven; and append-only is enforced only by the absence of columns
plus `GRANT SELECT, INSERT`, so proving accumulation through the real writer has non-zero value. The
security lens added a discipline that **is adopted** should such a spec ever be written: use explicit
`--captured-at` values rather than a wall clock, verify only via owner raw SQL, and never call
`listSeries`/`findLatest` through a scoped adapter — the moment it does, it becomes the read-path test
ADR-0044 D1 withholds. The test-integrity lens's own counter-argument is the one this ADR adopts: the
trigger "reads as an operational/runtime fact, not a test-suite artifact," so such a spec "would not
itself fire the trigger."

**The architecture lens ranked deciding ADR-0043 open question 2 as the next move, not referring it.**
Its argument: OQ2's answer is the only gate whose resolution is durable under every future — it survives
a CLI→HTTP replacement, survives a batch-ingest reshape, and is a precondition of A, B and C alike, the
same shape of bet that correctly made Slice A precede Slice B. **D6 adopts the diagnosis and rejects the
action.** Its own self-criticism is why: answering OQ2 honestly requires an authentication boundary or a
client registry, both barred by §3 of both prior ADRs, so an ADR-0045 that "decided" OQ2 could reach only
a decision it cannot implement — "an ADR whose entire deliverable is a document," by a lens that had just
argued a deliverable no external party can falsify is worth little.

**The skeptic lens argued this ADR should not exist** — that nothing be authorized and nothing be
decided, including the §4 amendment, on the grounds that the track's authorization set is empty and
every remaining item is either barred by a §3 list or gated behind an unfired trigger. **Its two
substantive recommendations are adopted in full** (repair the misleading test — D4; record that the
trigger cannot fire in CI and record the empty authorization set — D2 and D6), so the disagreement
reduces to whether recording those things warrants an ADR. It does: the §4 amendment is a change to an
Accepted ADR's operative text, and C1's correction overturns a premise the project handover was
carrying. Neither belongs only in a checkpoint doc.

Its strongest surviving objection is preserved and **not** resolved by this ADR: _"my 'wait' is a
permanent freeze — precisely the outcome §4 was written to prevent, and my refusal becomes the neglect
rather than the guard against it."_ §4's anti-neglect clause is the answer this ADR offers, and it is an
answer only if D6's referral is actually read by someone who can act on it.
