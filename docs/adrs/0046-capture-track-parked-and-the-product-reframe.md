# ADR-0046 — The capture track is parked-complete, not blocked; and the authorization set was never empty

Status: Accepted
Date: 2026-07-31
Supersedes in part: ADR-0045 (D6 — "the authorization set is empty"; and its factual premise)
Corrects: ADR-0043 (§4 open question 2; D4 mitigation 1), ADR-0045 (D6)
Relates to: ADR-0009 (Client Aggregate), ADR-0026 / ADR-0027 (capability context consumption
and readiness), ADR-0033 (RLS), ADR-0044 (snapshot read path and consumer)

---

## 0. How this decision was reached

### 0.1 The delegation

ADR-0045 D6 referred ADR-0043 open question 2 — _how does an operator obtain a legitimate
`clientId`/`organizationId`?_ — to the user as a **product** decision, deliberately declining to
decide it under the architect grant.

The user's response, verbatim:

> _"act as an architect, you know the final goal of the project. so you decide, if confused deploy
> council and decide"_

This ADR is therefore **self-accepted under the standing architect grant**, as ADR-0043 §0.1
established. Acceptance here is the architect's under a stated delegation. It is **not** a claim that
the user reviewed each decision below. The user delegated _the decision_; the decision is mine, and
so is responsibility for it.

### 0.2 A four-lens council, and the one that reframed the question

Four lenses were convened — long-term architecture, an adversarial skeptic briefed to authorize
nothing, security-and-invariants, and sequencing-and-delivered-value. Per ADR-0044 §0.1's
council-reliability finding and ADR-0045 §0.1, **every lens was given the code and the ADRs, and none
was given my prose.** All four disagreed with the framing in at least one material respect, which is
the behaviour that finding predicts.

**On the narrow question the vote was 3–1 against building anything**, and the dissenting lens named
the majority's central argument as its own strongest self-objection (§3). That is not a close call and
D1 follows it.

**But the decisive contribution came from the sequencing lens, which declined to answer the question
as put** and instead observed that ADR-0045 D6's candidate table enumerates six candidates, **all six
on the persistence/read track**. D6 reasoned correctly inside the track's frame and then reported its
conclusion as a statement about the product. That is the error this ADR exists to correct, and it is
mine, not the council's.

⚠️ **A methodological note on the skeptic lens, recorded against myself.** Its own closing objection
was that this is the _second consecutive council_ in which the skeptic's answer is "record, don't
build", and that **a lens that always says no has stopped being a lens.** That is a fair charge. The
answer is not to discount it this time — its reasoning on D1 is sound and is adopted — but to note
that D2 below is the first council outcome on this track that authorizes code, and that it was
reached by _widening the frame_ rather than by overruling the skeptic within it. If the next council
also produces "record, don't build", the correct response is to escalate the **governance** problem,
not to re-derive the same conclusion a fourth time.

---

## 1. Corrections to the record

### C1 — The ADR-0009 `Client` aggregate **exists and is implemented on `main`.** Two Accepted ADRs say it does not.

ADR-0043 §4 open question 2 states there is _"no ADR-0009 `Client` aggregate implementation."_
ADR-0045 D6 repeats it: _"no client registry, no tenant table, no ADR-0009 `Client` implementation."_

**Both are false.** Three lenses found this independently, and I verified it directly:

- `apps/api/src/modules/client/domain/aggregates/client.aggregate.ts:21` —
  `class ClientAggregate extends AggregateRoot<ClientId>`, with the canonical lifecycle transitions
  and their guards, and `InvalidTransitionError`.
- `apps/api/src/modules/client/domain/types/client.types.ts` — all six lifecycle states.
- `apps/api/src/modules/client/domain/repositories/client.repository.ts:5` — the `ClientRepository`
  port, including `findByOrganization`.
- Five domain events, two value objects, and `client.aggregate.spec.ts`.
- `docs/adrs/0009-client-aggregate.md` is `Status: Accepted` on `main`.

**What is actually absent** is narrower and far more useful to state precisely:

1. **No persistence.** `packages/persistence/src/prisma/schema.prisma` declares **exactly one**
   model — `ScoredBifSnapshot` at `:61`. There is no `clients` table and no `organizations` table.
2. **No repository implementation.** `apps/api/src/modules/client/infrastructure/index.ts` is a
   single comment line.
3. **No runtime identity.** `ClientId`/`OrganizationId` are branded aliases over an abstract
   `UniqueId` with no concrete subclass; the aggregate's own spec fabricates ids with `as any`.
4. **No authentication.** Nothing anywhere establishes _who is calling_.

⚠️ **This correction is a trap, not an opening, and must be read as one.** Corrected, open question 2
looks ~80% solved. It is not. What exists is the cheap, pure, in-memory portion that was never the
blocker. The blocker is item 4, and no in-repo artifact produces it. **Do not read C1 as authorizing
a client registry** — see D1, which rejects exactly that inference.

### C2 — ADR-0043 D4's mitigation 1 is **vacuous as written.** The code is fine; the ADR's description of it is not.

ADR-0043 D4 mitigation 1 requires that both ids _"must match the id shape the snapshot schema already
uses."_ The shape the snapshot schema uses is
`nonEmpty = z.string().trim().min(1)`
(`packages/business-discovery-contracts/src/scored-bif-snapshot-repository.ts:131-136`) — for both
`clientId` and `organizationId`.

**There is no shape.** `readStrictValue` (`apps/capture/src/capture-arguments.ts:180-203`) rejects
blank and whitespace-padded values and nothing else, which is the maximum that description can
license. `"clinet-a"`, a UUID for the wrong tenant, and an email address all pass.

Two lenses called this a gap; the skeptic argued it is already discharged and is in fact _stricter_
than required, because the parser refuses to trim padding rather than silently rewriting an id.
**Both are right about different objects, and the distinction is the finding:**

- The **code is correct** and arguably exceeds the requirement. Contrast `--captured-at`, which does
  get a real grammar (`capture-arguments.ts:79`) — because an ordering key needs one.
- The **ADR text overstates what it buys.** D4 concedes two paragraphs later that _"there is nothing
  to validate against"_, so ADR-0043 contradicts itself within one decision.

**This is an errata against the ADR text, NOT a code change.** Explicitly: **do not invent an id
grammar to close it.** A grammar guessed before a registry exists is a guess at ids the registry would
later mint — the speculative fix ADR-0044 D5 and ADR-0045 D5 both forbid. Once identity is real,
well-formedness is subsumed by resolvability and the question disappears rather than being answered
wrongly.

The only real mitigation the CLI ships is echo-and-`--confirm` (`capture-runner.ts:95-102`), which is
a human-factors control, not a technical one. Record it as such.

### C3 — PR #26 (second-hand; deliberately unverified)

The skeptic lens reported that PR #26 is docs-only (one file, `docs/adrs/0009-client-aggregate.md`),
is based on the stale `develop` branch, and that its content is already on `main` — so ADR-0045 D6's
parenthetical _"PR #26, which would supply one"_ is wrong twice: it would supply no implementation at
all.

⚠️ **This is recorded as second-hand and NOT independently verified.** PR #26 is declared out of scope
— _do not touch, close, merge, rebase or inspect it._ The lens was given only code and ADRs and so did
not know that constraint. I did not re-inspect, and **no action is taken or recommended on #26**. It is
recorded here solely so a future reader does not treat "merge PR #26" as an available answer to open
question 2.

---

## 2. Decisions

### D1 — **Reject** a client registry / `clients` table / `ClientRepository` implementation as the answer to open question 2.

Council vote: 3–1 against building, and the one lens that recommended building named this argument as
its own strongest self-objection.

The reasons are cumulative, and each is independently sufficient:

1. **A registry proves set-membership, never entitlement.** `--client-id client-b`, where `client-b`
   is a _real_ client, passes a foreign key, passes RLS's `WITH CHECK`, and still writes client A's
   business intelligence into client B's series. It removes the _typo_ case and leaves the
   _wrong-but-real_ case wide open — and wrong-but-real is **strictly worse** than a typo, because a
   phantom row harms nobody while a wrong-but-real row contaminates a live tenant's append-only series
   and is indistinguishable from their own data.
2. **It would encode an integrity claim the system cannot honour.** A schema-level FK reads to every
   future maintainer as a tenancy guarantee. It is not one. That _appearance_ is the specific harm.
3. **It is self-confirming — ADR-0045 D3's move, one level up.** With no authenticated provisioning
   path, the architect would author the registry, populate it by hand through the very
   trusted-operator path the registry exists to distrust, and then cite "capture now validates against
   the registry" as the discharge of open question 2. The evidence that a registry was needed would be
   the registry. ADR-0045 D3 rejected this shape when the artifact was a test; it does not become
   sound when the artifact is a table.
4. **It requires crossing schema + migration + RLS + grants** — four named stop conditions — to serve
   a writer that has never executed on behalf of a reader that ADR-0044 D1 forbids.
5. **The registry itself needs a tenancy policy, its own grants, and an answer to "who writes it"** —
   which is open question 2 again, one table over.

**Open question 2 remains open, and is hereby restated in its true terms:** the blocker is not a
missing aggregate and not a missing table. It is the absence of an **authenticated principal** whose
membership resolves to a scope. `ClientContext` must in the end state be _minted by a resolver
consulting an identity the caller cannot choose_ — never from `argv`, never from the payload, never
from the environment. That is an authentication boundary, it remains referred to the user, and no
amount of in-repo scaffolding produces it.

### D2 — **The authorization set was never empty.** ADR-0045 D6 is corrected: it described one track, not the product.

This is the substantive reversal, and it is a correction of my own prior reasoning.

ADR-0045 D6's candidate table lists six candidates. **All six are on the persistence/read track.**
Nothing on the produce side, the capability-bridge side, or the presentation side appears anywhere in
it. Each ADR in the sequence 0043 → 0044 → 0045 searched for its next move _within the same
subsystem_, and the track's momentum — not its value — kept generating the next question. D6's
instinct to refer the blocker outward was sound; the error was treating that referral as blocking
**the project** rather than **the track**.

Three gaps are unblocked by every Accepted ADR. Each was verified directly against the code:

- **G1 — the context-readiness bridge has zero callers.** `assessScoredBifContext` is wired into the
  Intelligence capability's own separate entry point (`intelligence-capability.ts:45`), exactly as
  ADR-0027 requires — and **nothing in `packages/demo-runtime`, `apps/api`, `apps/web` or `apps/demo`
  ever calls it.** The product's central claim — that discovered business context informs what the
  capabilities can responsibly say — is not wired anywhere, in memory or otherwise.
- **G2 — the scored BIF is invisible on every non-terminal surface.**
  `DemoService.getCapabilityDemo()` calls `runAllCapabilities()` and nothing else; it never calls
  `runBusinessDiscoveryIntake`. `CapabilityDemoResponse` has no field for completeness, confidence,
  or section counts. The 12-section canonical BIF, its scoring version and its deliberately-humbling
  `completenessScore` are reachable **only from a terminal**.
- **G3 — `produceOnly` is gated on nothing.** In `produceOnly` no connection opens and no
  `PrismaClient` is constructed (`capture-runner.ts:151-166`, `main.ts:33-37`). A wrong `--client-id`
  in `produceOnly` is **cosmetic** — `clientContext` only labels an in-memory result. **Open question
  2 gates the write path, not the produce path.** This is the single most important sequencing fact in
  this ADR and it was missed by ADR-0043, ADR-0044 and ADR-0045 alike.

⚠️ **Accuracy note against the sequencing lens.** It reported that `age-capture` has "no supported way
to be invoked." That is too strong: `apps/capture/package.json` has a `build` script, so
`build` + `node dist/main.js` works. What is true is that `bin` points at a build artifact, there is
no `start` script, no root-level script, and it has never been run. Record the accurate version.

### D3 — Authorized work, in order. Each is a separate slice with its own PR.

| #     | Slice                                                                                                               | Crosses                                                 | Gated by                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------- |
| **1** | Surface the Business Discovery / BIF scoring summary through `GET /demo/capabilities` and the web `/demo` page (G2) | `apps/api`, `apps/web` — **explicitly authorized here** | nothing                                  |
| **2** | Make `age-capture --mode produceOnly` invokable, and close H1 at the composition root (G3, D4)                      | `apps/capture` packaging                                | nothing                                  |
| **3** | Wire the context-readiness bridge so capabilities report readiness against the demo's `ScoredBifContext` (G1)       | `packages/demo-runtime`, demo baseline                  | **its own `Status: Proposed` ADR first** |

Slice 1 is first deliberately: it is read-only and additive, it needs no new computation
(`runBusinessDiscoveryIntake` is already exported from `@age/demo-runtime` and already returns a
ready-made summary), and it carries **no invariant hazard**.

Slice 3 is **highest value and highest hazard**, and is therefore authorized only in principle here,
not to build. It puts a `ScoredBifContext` into the capability runner's hands for the first time —
precisely the coupling ADR-0026/0027 created a separate entry point to prevent. It is one careless
line from a capability's output changing because of a context score, and it would ship into the
pinned demo baseline everything else is regression-tested against. **Preconditions, all mandatory:**
its own ADR; the invariant test written and **failing before** the wiring exists; the test scans
emitted string **content**, never `items.length` (a length check would pass while the real rule is
broken); and `run` is never gated on context.

**Still not authorized, unchanged:** any snapshot reader (ADR-0044 D1) · retiring `listSeries`
(ADR-0045 D7) · making `main.ts` testable (ADR-0045 D5) · a real `ClientContext` source · auth ·
workspace · `Draft → Active` promotion · schema/migration/RLS.

⚠️ ADR-0009's client lifecycle `Created → Active` is a **different axis** from BIF status
`Draft → Active`. The hard boundary bans the latter and says nothing about the former. Do not let the
shared word manufacture a false stop.

### D4 — H1: the capture composition root asserts nothing about the role it connects as. Recorded as a defect; fixed in Slice 2.

`openPrismaCaptureConnection` defaults to bare `new PrismaClient()`
(`apps/capture/src/capture-composition.ts:56`), which resolves `DATABASE_URL`. Across this repository
`DATABASE_URL` is the **owner** connection — `.github/workflows/ci-db.yml:63-66` states outright that
in that service container it _"is also the superuser — so it bypasses row-level security."_
`DATABASE_URL_APP` — the non-owner, `NOBYPASSRLS` role — is named nowhere in `apps/capture` except in
a comment. The live capture spec passes it explicitly, so the suite proves the chain works **as
`age_app`** and proves nothing about the default path.

⚠️ **Stated precisely, against the lens's stronger phrasing:** `DATABASE_URL` being a _superuser_ is a
property of the CI service container, not a proven property of any deployment. The defect is _"the
production composition root asserts nothing about its role, and repo convention points the obvious
variable at the owner"_ — **not** "capture provably runs as superuser." Do not restate it as the
latter.

**Fix it in Slice 2, not now.** The defect becomes reachable exactly when capture becomes invokable,
so the fix belongs with the slice that makes it invokable. The security lens's own objection is
adopted: a runtime privilege check adds a round-trip and a failure mode to a module ADR-0043 D9
deliberately kept free of connection management. The fix therefore goes at the **composition root**,
where connection concerns already live — not in `PrismaScoredBifSnapshotScopeRunner`.

### D5 — RLS is a **coherence** constraint here, not an authorization boundary. Record it correctly.

There is one application role, `age_app`, shared by every tenant, and the scope GUC is set by that
role with a value it chose (`prisma-scored-bif-snapshot-scope-runner.ts:99-100`). The policies compare
the row's columns to those same GUCs, and the scoped repository derives the GUC _from the record's own
key_ — so scope and row **agree by construction**.

RLS here is an excellent defence against the bug class it targets — unscoped query, leaked pooled
setting, scope inferred from payload — and it is proven live against a non-owner role under
`FORCE ROW LEVEL SECURITY`. Between two tenants served by the same role it provides **zero** isolation
against a caller that simply declares the other tenant's id. **Both halves of that sentence must
survive future summarizing.** No predicate over `current_setting('age.client_id')` can validate that
setting's legitimacy, because the setting is not a credential.

### D6 — The capture/persistence track is **parked-complete**, not blocked. Nothing rots.

The track banked durable assets: `ScoredBifSnapshotScopeRunner` and
`ScopedScoredBifSnapshotRepository` are required by any future caller and discarded by none, and the
RLS proof through the production adapter is real. Parking costs nothing: the table is append-only and
**empty of production rows**, and `listSeries` / `findLatest` / `findBySnapshotId` are tested and idle.

**"Parked-complete" is a status, not a euphemism for abandoned.** It is unparked by exactly one event:
an authenticated principal existing. Not by a row count, and not by anything the architect can author
— per ADR-0045 D2's finding that a trigger the architect can satisfy on demand is not a gate.

### D7 — A standing prohibition, carried forward with force.

**`age-capture --mode produceAndCapture` must not be run against any durable database until open
question 2 is answered.** Every row that exists today is a test fixture in a throwaway CI database.
The cost of getting scope wrong once is permanent and silent: no `updatedAt`, no `deletedAt`, no
`version`, `GRANT SELECT, INSERT` only, and no UPDATE or DELETE policy at all — so a mis-scoped row
cannot be corrected through the application, and under `FORCE ROW LEVEL SECURITY` it is invisible to
the tenant that should have received it. `changedBy` records a human-supplied string, not an
authenticated actor.

The urgency created by that cost asymmetry is **a prohibition, not a project.** It argues for writing
nothing until identity is real — not for building machinery to make writing feel safer.

---

## 3. Dissent, recorded

- **The architecture lens dissented from D1**, recommending a `ClientScopeDirectory` port plus a
  `clients` table. Its factual work was the strongest in the council — C1 is substantially its
  finding. **Its evidence is adopted; its conclusion is rejected.** This is now the third recorded
  instance on this track of that split (ADR-0044 §0.1, ADR-0045 §0.1), and it is the clearest: the
  lens's own closing paragraph conceded that the registry "becomes load-bearing only when something
  other than the architect populates it," which is D1's argument stated by the lens that opposed it.
- **The security lens dissented from D2's scope**, holding that nothing at all should be authorized
  and that only H1 should be repaired. D2 does not overrule it _within_ the capture track — where it
  is correct, and where D1/D6/D7 follow it — but declines to extend a track-local "build nothing" to
  the whole product.
- **The skeptic lens dissented from D2 entirely**, holding that only errata should be recorded. Its
  charge that a perpetually-negative lens has stopped functioning as a lens is recorded in §0.2
  against me, not against it.
- **The sequencing lens dissented from the question itself**, and was right to. Its reframe is D2.
  Its one overstatement is corrected in D2's accuracy note, and its own strongest self-objection
  became Slice 3's mandatory preconditions in D3.

---

## 4. Revisit trigger

Per ADR-0045 D2 — **state who may author the evidence, and narrow it before someone satisfies its
letter.**

This ADR is revisited when **an authenticated principal exists in this repository**: a caller whose
identity is established by something the caller cannot choose, from which a `clientId` /
`organizationId` is derived rather than asserted.

**The architect may not author that evidence.** A test fixture, a hand-populated table, a CLI flag, an
environment variable, and a mock resolver **all fail this trigger by construction**, individually and
in combination. It is fired by a product decision from the user about authentication, and by nothing
else.

Open question 2 is **not** revisited by: more rows, more tests, a client registry, or a corrected
understanding of what already exists.
