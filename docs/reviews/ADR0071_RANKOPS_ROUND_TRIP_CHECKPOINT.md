# The first peer round trip — RankOps (#333)

> The record of the first time an observation produced by a peer product travelled into AGE and
> AGE's answer travelled back out. Read this before touching the peer contract, and read
> `ADR0071_PEER_TRANSPORT_CHECKPOINT.md` first — it holds the decisions this exercise obeyed.

---

## 1. WHAT WAS PROVEN, IN ONE SENTENCE

A real RankOps ranking movement, read through RankOps' own running backend and worker, was admitted
by AGE as a semantic observation, associated with a real AGE subject, put through AGE's existing
deterministic derivation, and AGE's projected client context was read back by RankOps' adapter —
**and AGE concluded nothing from it, because one producer is not evidence.**

## 2. THE LOOP THAT RAN

Every hop below is the product's real path. Nothing was stubbed.

1. RankOps login against the running backend (real credential, real `JwtAuthGuard`).
2. `GET /api/rankings/:siteId/positions?days=28` — backend → Python worker → Postgres.
3. The RankOps `./core` AGE adapter turned three ranking movements into three AGE envelopes.
4. `age-capture relay --append --confirm` — AGE's existing operator-mediated inbound door.
5. AGE admitted all three, minting its own observation ids (never the source's).
6. AGE's real derivation ran over them.
7. `age-capture project` produced the `age.peer.v1` client-context document.
8. RankOps' `readAgeContextDocument` + `ageSubjects` read it back.

## 3. 🛑 THE FINDING THAT MATTERS MOST — SINGLE PRODUCER

Every derived subject came back with `reason: "single-producer"`.

**This is the correct outcome, not a failure of the exercise.** A finding drawn from one source
system is that source's observation restated. AGE reports it as a single-producer observation, not
as a conclusion — ADR-0069 D7, live, on real data. 🚫 **Do not read "the loop works" as "AGE now
produces cross-product intelligence."** It does not, and will not, until a second producer relays
against the same subjects.

## 4. 🛑 THE INTEGRATION BUG THAT EVERY GREEN TEST MISSED

The adapter's first version emitted `subject: {kind: "service", label}` and a two-instant period
`{startsAt, endsAt}`. **Both typecheckers were clean and every unit test on both sides passed.**
AGE refused all three observations at the door with `unrecognised-value at subject.kind`.

⚠️ **This is why a round trip is the test and a compiling interface is not.** The two facts the
adapter had to learn — and which `apps/cli/test/age.test.ts` now pins:

- `subject` is a **discriminated union**; `kind` is `modelled` or `unmapped`, and the _subject kind_
  lives underneath as `subjectKind`.
- `period` is **THREE instants** — `observedAt`, `windowStart`, `windowEnd`.

🚫 `observedAt` is a **required argument on the RankOps side, never a clock read** — a clock read
there would tell AGE the data is as fresh as the command that shipped it.

## 5. WHAT AGE DID NOT CHANGE

🛑 **No AGE semantic rule was altered to accommodate RankOps.** The whole of the adaptation happened
in the peer. AGE gained exactly one outbound command and one contract wrapper:

- `apps/capture/src/project-runner.ts` + the `project` subcommand — a **sixth subcommand, 🚫 not a
  flag on `inspect`**.
- `packages/client-context-projection/src/peer-contract.ts` — `AGE_PEER_CONTRACT = 'age.peer.v1'`,
  `document: 'client-context-projection'`.

🚫 No RankOps-specific store, table, field or escape hatch exists inside AGE. Raw ranking rows,
positions, clicks and URLs stay in RankOps; provenance **points at** them.

## 6. WHAT WAS REFUSED, AND STAYED REFUSED

- A mapping line naming a subject AGE does not model → `unknown-subject`, **reported**, 🚫 never
  silently dropped.
- A keyword with no movement in the window → `not-observed`. 🚫 It is not "flat".
- A row missing its trend → `not-observed`. 🚫 Never defaulted to stable.
- A subject kind AGE never captured → `never-captured` **with its reason**. 🚫 It is not an empty
  list of subjects, and the peer adapter must not offer it as a mapping target.
- 🚫 RankOps emits **only** the `modelled` arm. A line it cannot map is refused, 🚫 not relayed as
  an `unmapped` topic.

## 7. THE TRANSPORT BOUNDARY — 🛑 STILL EXACTLY WHERE ADR-0071 D3 LEFT IT

The round trip is **operator-mediated end to end**. 🚫 No HTTP ingest, no bus, no poll, no
scheduler, no background sync, no MCP auth middleware, no new listener, no peer credential,
principal or session. An operator ran each command and carried each document.

🛑 **A genuine unattended machine-to-machine round trip is therefore NOT proven and is NOT
possible today.** The minimum to cross that line is **ADR-0071 D3's own ADR** — the authenticated
peer protocol — which D3 explicitly left unresolved _as_ the decision. 🚫 Do not cross it with a
convenience flag.

## 8. WHERE THIS SITS ON THE LADDER

⚠️ `docs/product/ecosystem-integration/EI_01_TRACK.md`: this is **rung 5 at most, 🚫 never rung 6**.
🛑 **PROVING THE INTELLIGENCE LOOP IS NOT COMPLETING THE PEER INTEGRATION** (ADR-0071 D4), and
🛑 **"a peer sent AGE an observation" is still never said** — an **operator** presented it.

## 9. THE REUSABLE BASELINE

🛠️ `age.peer.v1` **is** the baseline for every subsequent peer (Ads, Content Intelligence, SNARA,
Humantik). 🚫 **Do not design a second integration architecture.** The peer's work is a translation
layer into this same envelope; anything a peer cannot express in it is **inadmissible and must be
reported as such**, 🚫 not accommodated by widening AGE.

## 10. ⚠️ WHAT THE DATA WAS

The business exercised was **conspicuously fictional** (`Wholly Invented Widgets (FICTIONAL)`,
`invented-widgets.invalid`). **The data is fictional; the code paths are real.** Real client rows
that exist in the local RankOps database entered **no** AGE artifact, fixture, test or document —
ADR-0053 D3 and ADR-0065 D1, unbroken.
