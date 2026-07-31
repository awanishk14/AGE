# AGE — Standing residuals: carry, do not "fix"

> **Extracted verbatim from the untracked handover's §1b** when that file passed its size budget.
> These are **accepted conditions**, not defects awaiting a fix. Each was recorded by an Accepted
> ADR that decided to live with it. "Fixing" one without re-opening its ADR undoes a decision.
>
> ⚠️ Several are stated as a **pair of halves** — a thing that is true and a thing that is
> **not** true. Both halves must survive any summarizing. The most common failure mode with this
> list is compressing a two-sided residual into whichever half is easier to say.

---

## The residuals

- **D4 trusts its operator.** A well-formed but wrong `--client-id` writes the wrong client's
  data to an append-only table. Only an authenticated caller closes this.

- **D10: nothing READS snapshots.** `findLatest` / `listSeries` / `findBySnapshotId` have **zero**
  non-test callers. A write path with a caller and no reader is exactly what was accepted.

- ⚠️ The old "no runtime caller" residual is **CLOSED by #156 in source only** — precision matters
  here (ADR-0045 C3). Produce genuinely runs:
  `packages/demo-runtime/src/business-discovery.ts:94` (`pnpm demo`). Capture **exists and has never
  executed** — `age-capture` is invoked by no workflow, no package script and no other package;
  `main.ts` has **zero importers**; the live spec injects its own `CaptureRuntime`, so the real
  clock, real id source and real `readFileSync` are on no path.
  ⚠️ **Updated by #166 — the unrunnability half is CLOSED, the rest is not.** It _was_ not merely
  uninvoked but **not executable** (`node dist/main.js` → `ERR_MODULE_NOT_FOUND`); #166 made it
  executable and it **has been run, in `produceOnly` only**. Everything above this line still holds:
  no workflow, no package script, no other package invokes it, and **`produceAndCapture` has never
  run.** Do not restate this as "no caller", and do not restate it as "capture runs" either.

- **`main.ts` is untestable by import** (it self-invokes at module top level), so its exit-code
  mapping and `.catch` fallback have **zero coverage**. Recorded by ADR-0045 D5; **not** authorized
  to fix.

- ⚠️ **ADR-0044 §4's trigger cannot be fired from inside this repo** (ADR-0045 D2 narrowed §4 to
  exclude test-suite-authored series). Only a human operator running `age-capture` against a real
  database twice for one identity fires it. The unfired element is the **writer**, never the row
  count.

- **`capture-cli.db.spec.ts`'s replay test pins `snapshotId` to a constant**, so it proves append
  idempotence under a **full-primary-key** replay — **not** that a series is forbidden. Renamed and
  commented in #158; do not "restore" the old reading (ADR-0045 C2/D4).

- ⚠️ **The ADR-0009 `Client` aggregate EXISTS on `main`** — `apps/api/src/modules/client/domain/
aggregates/client.aggregate.ts:21`, full lifecycle + guards + 5 events + `ClientRepository` port +
  specs. **Two Accepted ADRs (0043 §4 OQ2, 0045 D6) say it does not — they are wrong** (ADR-0046 C1).
  ⚠️ **This is a TRAP, not an opening.** It makes OQ2 look ~80% solved; it is not. Absent: any
  `clients` table (`schema.prisma` has **exactly one** model), any `ClientRepository` impl
  (`client/infrastructure/index.ts` is one comment), a concrete `UniqueId`, and **authentication** —
  which is the entire blocker. **Do not read this as authorizing a registry** (ADR-0046 D1 rejects
  it).

- **ADR-0043 D4 mitigation 1 is vacuous as written** (ADR-0046 C2). The **code is correct** and
  arguably stricter than asked (`readStrictValue` refuses to _trim_ padding rather than silently
  rewriting an id); the **ADR text** overstates it, since the shape it cites is `nonEmpty` only.
  ⚠️ **Errata, NOT a patch — do NOT invent an id grammar to "close" it.** A grammar guessed before
  identity exists is a guess at ids a registry would later mint. Once identity is real,
  well-formedness is subsumed by resolvability and the question disappears.

- ~~D4 (ADR-0046): the composition root asserts nothing about its role~~ — **CLOSED by #164.**
  ⚠️ Carry the precision that survived it: the superuser property was CI's service container, **not**
  a proven deployment fact. Never restate the old defect as "capture ran as superuser."

- **RLS here is a COHERENCE constraint, not an authorization boundary** (ADR-0046 D5). One shared
  `age_app` role sets a GUC it chose; the scoped repo derives that GUC from the record's own key, so
  scope and row agree by construction. Excellent against unscoped queries / leaked pooled settings /
  payload-derived scope — and **zero** isolation between two tenants on the same role against a
  caller that simply declares the other's id. **Both halves must survive summarizing.**

- 🚫 **STANDING PROHIBITION (ADR-0046 D7): never run `age-capture --mode produceAndCapture` against
  any durable database** until an authenticated principal exists. Every existing row is a CI fixture.
  A mis-scoped row is uncorrectable (no `updatedAt`/`deletedAt`/`version`, `GRANT SELECT, INSERT`
  only, no UPDATE/DELETE policy) and invisible to the tenant that should have received it.
  The cost asymmetry is **a prohibition, not a project** — it argues for writing nothing, not for
  building machinery to make writing feel safe. `--mode produceOnly` is unaffected and opens no
  connection at all.

---

## The gate table — what is blocked, and by what

| Still gated                                                       | Why                                                                                                  |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **A client registry / `clients` table / `ClientRepository` impl** | **REJECTED by ADR-0046 D1** (council 3–1). Proves set-membership, never entitlement; self-confirming |
| Snapshot **consumer** / trend reader                              | ADR-0044 D1; ADR-0045 D2                                                                             |
| ADR-0044 §1 C1's narrow gap                                       | A **read-path** test; D1 gates read work                                                             |
| Retiring `listSeries`                                             | **Rejected** by ADR-0045 D7                                                                          |
| Making `main.ts` testable                                         | **Rejected** by ADR-0045 D5 — residual only                                                          |
| ADR-0041 open question 1                                          | Recorded **unremovable** — a residual, not a decision                                                |
| Auth · workspace · `Draft → Active` · schema/migration/RLS        | Never authorized                                                                                     |

⚠️ **Do NOT write a two-capture live spec** (ADR-0045 D3): self-confirming, near-empty coverage.

⚠️ **A live multi-member series is ALREADY PROVEN** — storage, `capturedAt DESC` ordering, the
`snapshotId DESC` tie-break and `findLatest`, in `scored-bif-snapshot.db.spec.ts` and through the
**production** scoped repository in `scored-bif-snapshot-rls.db.spec.ts`. **Do not rebuild any of
it.**

⚠️ ADR-0009's client lifecycle `Created → Active` is a **DIFFERENT AXIS** from BIF status
`Draft → Active`. The boundary bans the latter only. Do not let the shared word manufacture a stop.

---

## Why this list is a document rather than a memory

Every entry here was learned by nearly making the mistake it describes. The pattern that keeps
recurring: a residual gets summarized into its shorter half, the shorter half reads like an
unfinished task, and the next session "finishes" it — undoing an accepted decision without ever
seeing the ADR that made it.

⚠️ **Append here rather than rewriting.** When an entry genuinely closes, strike it through and keep
the precision that survived it (see the ADR-0046 D4 entry above for the shape) — a deleted entry
takes its warning with it.
