# ADR-0055 — the row nobody reads: track checkpoint

> The durable record for the snapshot-read track. ⚠️ Append, never rewrite.
> `CLAUDE.md` carries only a pointer and the tripwires still live on an active slice.

---

## §1 — D6/D7 discharged (2026-08-08, before #260)

The precondition ADR-0055 D7 states: nothing may read the capture store until a real
row exists in it. It was discharged **on the operator's instruction and with their own
answers**, not by the architect and 🚫 **never by seeding a row**.

The second live test client (🚫 **never name it in a commit**) went draft → submit →
`onboard --capture --confirm` against the operator's own local Postgres.

| Fact              | Value                               |
| ----------------- | ----------------------------------- |
| Rows in the store | **one**                             |
| Scope             | `client == organization`            |
| `changedBy`       | `operator:awanish14`                |
| Scores            | **confidence 14 / completeness 11** |
| Sections          | 6 present + 6 omitted               |
| Status            | `Draft`                             |

🚫 **DO NOT "HELP" THAT SCORE BY TOUCHING A CAP** (ADR-0054 D7). A low score for a first
real client is a **correct result**. ADR-0051's 35 cap was lifted by making the evidence
real, never by raising a number.

Two environment facts, 🚫 neither a code change:

- The CLI connects as **`DATABASE_URL_APP`** (non-owner `age_app`), and 🚫 **never falls
  back to `DATABASE_URL`**.
- The migration's guarded `GRANT` is skipped when `age_app` does not yet exist, so the
  grants were re-applied by hand.

⚠️ The answers, the answer file and the client record all live **outside the repo** and
🚫 are never committed.

---

## §2 — #260: `age-capture inspect` (merge `d730db0`, runs `31268800378` / `31268800357`, 15 + 18 steps)

The first code path in AGE that loads a row a **previous** invocation wrote. ADR-0054 D7
states the falsification test as a stored profile the operator can _look at_; this is the
second half of that sentence.

### §2a — why this and NOT S11

🛑 I had reported S11 (History & diff) as the next slice. **It is not**, on three grounds
each verified against `main`:

1. **ADR-0055 D1** authorizes the read as `age-capture inspect` — _"and no other
   surface"_. A Studio screen is not covered by it.
2. **ADR-0055 §5 item 1** puts cross-snapshot reading (`listSeries`, diffs, "since last
   capture") under _"Recorded, NOT authorized"_ — it needs its own `Proposed` ADR.
3. `ST_02_SCREENS.md:331–338`: _"A comparison needs two snapshots and there are zero."_
   The 2026-08-08 run produced **one**. ⚠️ A second real client run is a precondition
   **no code can supply**.

Corroborating: `apps/studio/src/server/effect-isolation.test.ts` bans `@age/persistence`
and `@prisma/client` outright, so a snapshot-reading screen would require changing a
**shipped safety property**.

### §2b — the shipped refusals (🚫 read before undoing anything)

- 🚫 **NO `--organization-id`, AND IT IS REFUSED BY NAME** — not as "Unknown flag", which
  reads as a typo instead of as a refusal. Scope comes from `toClientContext(record)` and
  nowhere else. ⚠️ RLS checks a row against the scope the transaction **asked for**, never
  against an entitlement to it (ADR-0046 D5, ADR-0055 D9) — so a typed scope is a read in
  a scope no record of the operator's describes, and the database would happily agree.
- 🚫 **IT CANNOT WRITE, AND NOT BECAUSE IT DECLINES TO.**
  `openLocalPrismaSnapshotReadConnection` returns a **façade** of two reads and a close;
  `ScopedScoredBifSnapshotRepository` — which implements `append` — **never escapes the
  function**. A guard asserts the façade's exact key set, and asserts `inspect-runner.ts`
  never names `.append(`, `Orchestrator` or `produceAndCapture`. ADR-0046 D7 is **not
  repealed** outside ADR-0054 D6's five conditions.
- 🚫 **`listSeries` IS A SEPARATE REFUSAL FROM `append`**, and it is one bound method away
  from existing — which is exactly why a guard asserts the binding is absent.
- 🚫 **NO AGGREGATE, NO BAND, NO READINESS REPORT, NO VERDICT WORDING.** A guard scans the
  output for `ready|weak|strong|poor|healthy|overall|grade`. ⚠️ D4's architect lens
  recommended rendering the stored context through `buildContextReadinessReport`; the ADR
  **rejected it on that lens's own reasoning** (finding 8 — adopt a council's evidence and
  its conclusion separately).
- 🚫 **`BOOLEAN_FLAGS` IS DELIBERATELY EMPTY.** Declaring `--capture`/`--confirm` so they
  could be rejected "properly" would put the two tokens that authorize a write into the
  parser of the command that must never perform one. They are refused **by name**, with
  the reason, via `DERIVED_FLAGS`.
- 🚫 **THE CLIENT DISPLAY NAME IS NEVER ECHOED** — this output is the thing most likely to
  be pasted into an issue, and the record file holds a real business's name.

### §2c — 🛑 THE DECISION D4 COULD NOT ANTICIPATE (the finding)

D4 asks for _"the four scores kept separate"_. **The row structurally holds two.**
`ScoredBifContext` is projected solely from a `BusinessIntelligenceFramework`, and
`discoveryConfidenceScore` / `discoveryCompletenessScore` live on the discovery profile —
deliberately out of scope so intake metrics cannot leak into capability-facing context
(`scored-bif-context.ts`, the "NOT DISCOVERY SCORES" paragraph).

**Decision:** both lines print
`not stored in the snapshot (a discovery-profile metric, not a BIF metric)`.
🚫 A `0`, a blank, or simply omitting the lines would each turn _"AGE never kept this"_
into _"AGE kept this and it was empty"_. A guard asserts neither ever renders as a digit.

⚠️ **This is an ADR expectation exceeding what the artefact holds** — recorded here rather
than silently satisfied. Any future slice that wants four real scores must persist the
discovery pair somewhere, which is a **new decision needing its own ADR**, 🚫 not a
rendering change.

### §2d — order and failure modes

- ⚠️ **THE RECORD IS RESOLVED BEFORE THE CONNECTION IS OPENED** — a _different_ reason
  from `onboard`'s. There it is so a run with no scope does not open the operator's
  answers; here it is so a run with no scope **never reaches a database**. Guards assert
  `opened.count === 0` on every refusal path.
- **A miss gets its own exit code (`snapshotNotFound: 6`)** and says _"No snapshot in this
  scope"_, with the searched scope still echoed. 🚫 An empty report would read as a claim
  about the **client**; this is a claim about the **query**. The empty-series and
  pinned-id misses word differently.
- **A corrupt row's throw propagates** (D5). Stored rows are untrusted input; rendering a
  partially-valid row is the one outcome worse than stopping. `main.ts` prints the error
  **name** only — 🚫 never the message, 🚫 never a stack. The connection is released in a
  `finally`.
- ⚠️ **LOCAL-ONLY, ASSERTED ABOVE `new PrismaClient(`.** Reading is **not** harmless: a
  remote target would pull a real client's stored business context onto whatever machine
  ran the command. 🚫 A loopback host remains **NECESSARY, NOT SUFFICIENT** — an SSH
  tunnel from `localhost:5432` passes it.

### §2e — the five guards made to fail by mutation

⚠️ A guard is evidence only once it has been **made to fail**. Each mutation was applied,
confirmed to name the mutation, and restored.

| Mutation                                                   | Caught by                                              |
| ---------------------------------------------------------- | ------------------------------------------------------ |
| Bind `listSeries` into the façade                          | `binds no listSeries into the façade…`                 |
| Move `assertLocalDatabaseTarget` below `new PrismaClient(` | the same guard's ordering assertion                    |
| Print `discoveryConfidenceScore: 0`                        | `says the two discovery scores are NOT STORED…`        |
| Add an `overall: not ready` line                           | `renders no verdict, no band and no readiness wording` |
| Open the connection before resolving the record            | all three "without opening a connection" guards        |

### §2f — what this slice did NOT prove

🚫 **This suite must never be cited as if it had proved the row decodes.** It proves the
_shape_: which scope reached the store, that a miss reports as a miss, that nothing was
fabricated when something was absent. Whether the row written on 2026-08-08 actually
round-trips is a fact about the **operator's own database**, and only running
`age-capture inspect` against it answers that. 🛑 **That run is the operator's to
perform** — the same shape as D6/D7 before it.

### §2g — structure

Three-module seam intact: decisions pure over `argv` + an injected runtime
(`inspect-arguments.ts`, `inspect-runner.ts`) · the only `new PrismaClient(` in
`capture-composition.ts` · every effect in `main.ts`. The purity guard's `CORE_MODULES`
grew by both new modules. The read connection is imported **lazily**, so `produceOnly`
still needs no `@prisma/client`, no credentials and no `prisma generate` —
`scripts/bundle.mjs`'s two-sided lazy-chunk assertion passes.

⚠️ `INSPECT_SUBCOMMAND` is a **third dispatcher branch, not a `--read` mode**. A mode
would put a read and a write behind the same parser and the same runtime, and the runtime
is where the append handle lives.

---

## §3 — what remains unauthorized on this track

- 🚫 **Cross-snapshot reading of any kind** — `listSeries`, diffs, trends, "since last
  capture", S11. ADR-0055 §5 item 1. Needs its own `Proposed` ADR **and** a second real
  row that only the operator can create.
- ⚠️ **ADR-0055 D8 fixes the ceiling:** the slice after this one must **feed a capability
  from a real stored context instead of a fixture.**
- 🚫 Nothing here authorizes a Studio screen over the snapshot store, identity, a session,
  a login, or a hosted frontend.
