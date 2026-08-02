# ADR-0055 — The row nobody reads

Status: Proposed
Date: 2026-08-02
Relates to: ADR-0026 D4 (absence is a limitation, never negative evidence), ADR-0027 (readiness is a
separate named entry point, never a gate on `run`), ADR-0044 D1/D2/D4/D5/D6 (the snapshot read path
and its consumer), ADR-0046 D5 (RLS is coherence, not authorization) and **D7 (no capture writes)**,
ADR-0049 D2 (no default parameter), ADR-0053 D4/D5/D6 (the operator principal, the required
`clientContext`, the CLI is the surface), **ADR-0054 D6/D7 and §5 items 1 and 5 — recorded, NOT
authorized**, and ADR-0054 §0.1d (the stopping point this ADR exists to lift).

---

## 0. How this decision was reached

### 0.1 Standing

Written under the standing architect grant recorded in ADR-0043 §0.1 and reaffirmed by the mandate
the user gave on 2026-07-30.

🚫 **This ADR is `Status: Proposed` and MUST NOT be self-accepted.** ADR-0054 §0.1d is the Product
Owner's own stopping point, added by them and not by the architect:

> **"Stop" means stop.** The first true runtime caller is the **next** architectural phase and is
> **not** authorized by this ADR.

An architect who lifts a stop the Product Owner set, under a grant the Product Owner wrote, has
converted a delegation into a self-issued permission. The grant covers deciding _what_ to build; it
does not cover deciding that a stop has expired. **The Product Owner accepts, amends or rejects this
in their own words.** Until they do, no code is written from it.

### 0.1b The council, and what it disagreed about

Four lenses were run in parallel against **the code, not the architect's prose** (ADR-0043 finding 7:
prose launders the architect's own errors back as independent confirmation). Lenses do not know the
repository's fences, so their findings are filtered on the way out and second-hand claims are marked.

**Three of four lenses independently chose the same next slice — a reader.** That convergence is
recorded, but convergence is not evidence, and §0.1c records what each of them said against it.

### 0.1c Dissent — 🚫 do not delete, soften, or mark as mitigated

**Dissent 1 (skeptic) — "this is the seventh shape-only slice, and the prettiest one yet."**
The lens' ranked finding was that the snapshot store is write-only: a repo-wide search for
`findLatest` / `listSeries` / `findBySnapshotId` outside the persistence package's own source and
tests returns **nothing**. Its verdict on the whole apparatus:

> The code is not lying. The aggregate is. 220 PRs have produced an exceptionally disciplined,
> well-tested, thoroughly-governed apparatus whose output has never been consumed by anything but
> itself. The gap is not capability, architecture, or rigor — all three are unusually good. The gap
> is that **nothing has ever been allowed to be wrong**, because nothing has ever been asked a
> question with a real answer.

It would refuse **any further guard test, purity assertion or governance document until a snapshot
has been read**, and it named the temptation directly: _"surface area is the favorite hiding place
of an unfalsified product."_ ⚠️ **This dissent is upheld, not answered** — see D8.

**Dissent 2 (architect, arguing against its own recommendation) — "a codec assertion in a CLI."**

> The row is not unconsumed because reading is hard; it is unconsumed because nothing downstream is
> authorized to act on it.

A reader shows the operator, who typed the answers minutes earlier, what they typed. The one genuinely
new fact — that the PostgreSQL round-trip is lossless — is already asserted by
`scored-bif-snapshot-row-json-type.spec.ts` and the `ci-db.yml` live tests. ⚠️ **Partly upheld** —
it is why D3 exists and why D4 exists in the form it does.

**Dissent 3 (security) — "the reader is not the highest-risk thing in the repository."**
It named a work item this ADR does **not** schedule: authenticated principal → authorized scope
resolution, landed **before** any networked surface, not alongside one. ⚠️ **Recorded and left
standing as a ceiling, not adopted as this slice** (D9). Its four message-hygiene findings are
adopted, because they are defects in a rule ADR-0054 already set — see D6.

**Dissent 4 (sequencing) — "the reader is worthless until the operator has run the write."**
A reader over an empty table is another shape-only slice. ⚠️ **Upheld as a precondition** — D7.

### 0.2 Findings taken as fact, verified in the code rather than accepted from a lens

Per ADR-0043 finding 8, a council's **evidence** and its **conclusion** are adopted separately.

1. **ADR-0054 D7's success test is currently unmeetable.** D7 states the falsification test as
   answers → a stored snapshot _"which the operator can then read back."_ `CaptureConnection`
   exposes only `{ orchestrator, close }`, and the orchestrator is append-only by construction. The
   shipped CLI can write a row and can never see one. **This is a governance defect — an accepted
   ADR whose own success criterion no possible operator action can satisfy — not a feature request.**
2. **The read port is complete and unused.** `findLatest`, `listSeries` and `findBySnapshotId` are
   implemented on every adapter; `fromScoredBifSnapshot` re-validates untrusted stored input; and
   ADR-0044 D4's major-version read gate `assertReadableSnapshotVersion` is repaired. The only
   missing piece is a caller.
3. **Two refusal messages leak file content, and this was verified empirically, not reasoned.**
   `load-client-record-file.ts` and `parse-discovery-answer-file.ts` both interpolate a failed
   `JSON.parse` message into their refusal. On the installed Node (v24.16.0) V8 embeds a snippet of
   the source: a malformed client-record file prints a **fragment of the record** — which may carry
   `displayName` and `externalRefs` ad-account ids — to stderr. ⚠️ The client-record loader takes
   care to name _"the position, NOT the record's contents"_ three lines further down. **The rule is
   right and two implementations of it are wrong.**
4. **The answer-file validator echoes the operator's answer text.** A `choice` mismatch prints
   _"…but the file supplied `"<value>"`"_. ADR-0054 D1 requires the validator to name the question
   id and never the answer text.

---

## 1. Context

ADR-0054 shipped the path: an operator's own two files become one immutable scored-BIF snapshot row
in their own local database. §0.1d then stopped the track, deliberately, so the Product Owner could
decide what the next phase is rather than inherit it.

This ADR asks for exactly one thing back: **the ability to look at the row.** It is ADR-0054 §5
item 1 — _"a reader that shows a stored snapshot back to the operator"_ — which §5 records as
**recorded, NOT authorized**, and which therefore cannot begin without this decision.

It is proposed now, and not later, because of §0.2 finding 1: without it, ADR-0054 D7 can never be
discharged by anyone.

---

## 2. Decisions

### D1 — A read-only `inspect` subcommand on `age-capture`, and no other surface

`age-capture inspect --records <path> --repository-root <path> --client-id <id> --bif-id <id>
[--snapshot-id <id>]`.

Scope comes from `toClientContext(record)` and from nowhere else. 🚫 **No `--organization-id` flag;
typing one is refused BY NAME**, exactly as `onboard` refuses it — not as "Unknown flag", which reads
as a typo rather than as a refusal. ⚠️ **The record is resolved before the database is opened**, and
the client's **display name is never echoed**.

🚫 **No HTTP, no `apps/api`, no `apps/web`, no second human.** ADR-0053 D6 says the surface AGE needs
today is the CLI. Anything networked crosses ADR-0053 dissent 1's ceiling and must build
authentication first (D9).

### D2 — The connection this command opens must be structurally incapable of writing

A **third** separate composition function, `openLocalPrismaSnapshotReadConnection`, with
`assertLocalDatabaseTarget` asserted **above** `new PrismaClient(`.

🚫 It must **not** return `ScopedScoredBifSnapshotRepository`, which satisfies the full port and
therefore carries `append`. It returns a façade narrowed to reads. ⚠️ **A read command holding a live
append handle is a `produceAndCapture` waiting to happen, and ADR-0046 D7 is not repealed outside
ADR-0054 D6's five conditions.** 🚫 Not a flag on an existing function: a shared function with an
escape hatch is the same rule with a documented way past it. 🚫 `capture-composition.ts` remains the
only production module containing `new PrismaClient(`.

### D3 — This slice adds no write path of any kind

🚫 No `append`, no `--capture`, no "refresh", no re-score-and-store, no remediation primitive. The
append-only invariant is untouched and **the demo baseline must not move**: 98/63 intake vs 12/17
BIF, band `strong`, 7 populated + 5 omitted, `sample-output.txt` byte-identical. If it moves,
something other than this plumbing changed and the change is wrong.

### D4 — The reader prints the stored projection, and does NOT render a readiness report

The architect lens recommended rendering the stored context through `buildContextReadinessReport`.
**Rejected**, on its own dissent-2 reasoning: readiness has had exactly one caller in AGE's history,
and spending its second on a surface that by design must not recommend anything (ADR-0027 forbids
ranking, shortlisting or hinting at an action) buys presentation, not knowledge.

The reader prints: the echoed scope, the snapshot's identifiers, its `capturedAt`, the four scores
kept separate, and the populated/omitted section names. 🚫 **No aggregate, no ranking, no ordering by
state, no badge, no "2 of 3 ready", no colour.** 🚫 No capability `run` invocation. 🚫 No BIF status
promotion and no wording that implies one.

### D5 — A missing snapshot is a named refusal, and a corrupt one is a throw

`findLatest` returning nothing is _"no snapshot in this scope"_ with its own exit code — 🚫 **never an
empty report**, which reads as "this client has nothing" rather than "nothing was found". A stored
row that fails `fromScoredBifSnapshot` propagates the throw; 🚫 it must never render partially.
⚠️ Stored rows are untrusted input, and this is the first code path in AGE that will actually treat
them that way against real data.

### D6 — Four refusal messages are corrected to name a position, never content

Adopted from the security lens, verified in §0.2 findings 3 and 4:

1. `parse-discovery-answer-file.ts` — name the question id and the allowed choices; 🚫 never the
   supplied value.
2. `load-client-record-file.ts` and `parse-discovery-answer-file.ts` — 🚫 do not interpolate a
   `JSON.parse` message. Say the file is not valid JSON and stop.
3. `onboarding-runner.ts` — print a Prisma error's **name or code**, 🚫 never its raw message, which
   for the validation class renders the full `data` argument — i.e. the client's business facts in
   their own words.
4. `main.ts` — print `error.message`, 🚫 not `error.stack`, for an unmodelled throw.

⚠️ These are **defects in ADR-0054 D1/D3's own rule**, not new policy. Each gets a test that is
**made to fail** before being trusted.

### D7 — This slice must not be started before the operator has performed the D6 write

⚠️ A reader over an empty table is the shape-only slice ADR-0053 dissent 2 forbids. The first thing
`inspect` is run against must be a row the operator actually wrote from a real client's answers.
🚫 Do not seed a row to unblock development.

### D8 — The skeptic's ceiling is adopted as the ceiling on the slice AFTER this one

⚠️ **The slice after this one must feed a capability from a real stored context instead of a
fixture** — even if the honest result is zero signals. As dissent 1 put it: _a capability that
returns "insufficient" on real data is worth more than six that return HIGH on fixtures._

🚫 **Refused for the next slice, categorically:** a seventh capability, a new "engine", a new
contracts package, any mcp-ads or RankOps wiring, any API/Web/auth/multi-user/background surface, and
any change that improves a score, lifts a cap or enriches a fixture.

### D9 — The security ceiling, recorded and NOT scheduled here

⚠️ **Scope is currently asserted by the caller and only checked for self-consistency.** RLS
guarantees a row agrees with its own declared scope; it never checks that the actor was entitled to
that scope. The moment an HTTP handler derives `clientId` from a request, every tenant sharing
`age_app` reads every other tenant's snapshots — **this is a property the current design already has,
which single-user operation conceals.**

Therefore, before any second human or network listener: **an entitlement function must become the
only producer of a `ClientContext` for persistence**, with a guard asserting `runInScope` is
unreachable except downstream of it. 🚫 Retrofitting this under an existing endpoint means the
endpoint ships with tenant scope as a request parameter, and that is not removable afterwards.

⚠️ **Recorded is not authorized. D9 is not this slice and needs its own ADR.**

---

## 3. What this ADR does NOT claim

1. ⚠️ **It does not claim the reader makes AGE useful.** Dissent 1 and dissent 2 both say it does
   not, and both are recorded unanswered. It claims only that ADR-0054 D7 is otherwise unmeetable.
2. ⚠️ **It adds no authentication and does not reduce the need for it** (D9).
3. ⚠️ **A loopback host remains necessary, not sufficient** — an SSH tunnel from `localhost:5432` to
   a shared server is loopback and is exactly what ADR-0054 D6 forbids.
4. 🚫 **No real client record, answer file or stored context is committed** — not redacted, not
   masked. Private is not a control; obvious fictionality is the guard.

---

## 4. Consequences

**If accepted:** ADR-0054 D7 becomes dischargeable, the persistence tier gains its first consumer,
and the four leaks in §0.2 are closed. The next slice is fixed by D8 and is not the architect's to
choose.

**If rejected:** ADR-0054 D7 stays unmeetable and should be amended to say so, rather than left as a
success criterion no action can satisfy. The four D6 message defects should be fixed regardless —
they are bugs in an accepted rule, not new work.

---

## 5. Recorded, NOT authorized

⚠️ **This section is not a to-do list.** Each item needs a fresh `Status: Proposed` ADR, read in its
own words. **Next number after this one is 0056.**

1. Cross-snapshot reading — `listSeries`, diffs, trends, "since last capture". ⚠️ ADR-0044 D5's
   `listSeries` is unpaginated and D6 forbids reporting that a change _happened_ rather than that the
   series _records_ one.
2. Feeding a capability from a real stored context (D8 sets the ceiling; it does not authorize it).
3. Deleting the unreachable packages the skeptic identified.
4. D9's entitlement function, and authentication.
5. Any mcp-ads or RankOps integration.
