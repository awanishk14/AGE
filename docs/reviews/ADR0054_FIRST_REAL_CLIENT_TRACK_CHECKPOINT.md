# ADR-0054 — First-real-client track checkpoint

> Per-PR record for the slice that let a real business's own answers reach a stored row.
> **Append, never rewrite.** Read this before touching `@age/discovery-answer-file`,
> `@age/operator-file-policy`, or the `onboard` subcommand in `apps/capture`.

## Why this track exists

~200 merged PRs, six capabilities and a frozen architecture — and **every surface was fed by one
frozen sample profile**. ADR-0053's dissent 2 set the ceiling: the next slice could not be a sixth
shape-only slice. ADR-0054 is the answer to "what would it take for one real client's answers to
produce one real stored result", and its §5 is deliberately **not** a to-do list.

⚠️ **Slice B adds no authentication and does not claim to.** It is one operator, one terminal,
one local database.

---

## §0 — The governance facts, because they are easy to lose

| ADR-0054           |                                                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `Status: Proposed` | **#212** (`72600c7`). ⚠️ Its own CI run `30717388162` was **BILLING-BLOCKED, 0 steps, never green**; `72600c7` was first covered by #213's run. |
| `Status: Accepted` | **#213** (`a8ec807`). CI **success, 15 steps**.                                                                                                 |

⚠️ **NOT self-accepted.** The Product Owner accepted it in their own words (ADR §0.1b), and in doing
so **added** a fifth D6 condition — _no background execution, scheduling or automation_ — and a
**stopping point** (§0.1d). Both are load-bearing and neither came from the architect.

🚫 **D6 is a conditional permission. ADR-0046 D7 is NOT repealed.** Outside D6's five conditions,
`produceAndCapture` against a durable database remains refused, unchanged.

---

## §1 — D1/D2: the operator-authored answer file (#214)

`@age/discovery-answer-file`. Reads a file the operator wrote, validates it **against the
questionnaire**, and fails closed **naming the offending question id**.

### ⚠️ Do-not-undo list

- 🚫 **The path is a required parameter with NO DEFAULT.** A default makes the whole path
  unfalsifiable behind a signature that only _looks_ parameterised (ADR-0049 D2).
- 🚫 **A path inside the working tree is REFUSED.** ⚠️ _".gitignore is not the control"_ — this is a
  refusal, not an ignore rule, and the error must never suggest adding an ignore entry.
- 🚫 **No working-directory search.** The rule must not depend on where the operator was standing.
- 🚫 **The validator names the question id, never the answer text.** A refusal that echoed the answer
  would put a real business's words into a terminal log.

---

## §2 — D3: loading the real `ClientRecord` (#215)

An operator-authored record file, loaded and validated; **an unknown id refuses and never
fabricates**. The **shared path policy was extracted to `@age/operator-file-policy`** rather than
copied, at the Product Owner's direction.

⚠️ **Why extraction and not a copy:** two copies of one fail-closed rule drift silently, **because
the relaxed copy still passes its own tests.** This is the single most reusable lesson on the track,
and it was applied a second time in §4.

---

## §3 — D5: the hub-and-spoke guard (#216)

Mutation-proven, as the repo requires. ⚠️ Per ADR-0054 §0.1c, the guard is evidence about **this
repository only** — it is not a claim about the architecture in general, and the dissents it relates
to are **not to be deleted, softened, or marked as mitigated**.

---

## §4 — D6: the end-to-end local onboarding run (#217)

`main` → **`4209812`**. PR CI **success, 15 steps**; post-merge run `30753436310` matched by
`head_sha`, **15 steps, success**. Live-database workflow also success.

An `onboard` subcommand on `age-capture` that takes the two files an operator actually has and
derives everything else:

```
age-capture onboard --answers <path> --records <path> --repository-root <path> \
  --client-id <id> --changed-by operator:<handle> --profile-id <id> [--capture --confirm]
```

### D6's five conditions, and WHERE EACH ONE ACTUALLY LIVES

A condition that lives only in an ADR holds until the first tired evening.

| Condition                                 | Mechanism                                                                                                                                                                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Scope from a loaded `ClientRecord`     | `toClientContext(record)` is the only source of a `ClientContext`. There is **no `--organization-id` flag**, and typing one is refused **BY NAME** — not as "Unknown flag", which reads as a typo rather than as a refusal. |
| 2. A local database the operator controls | `assertLocalDatabaseTarget`, asserted **above** `new PrismaClient(`.                                                                                                                                                        |
| 3. Explicitly requested                   | `--capture --confirm`, after the scope is echoed (ADR-0043 D4, unchanged).                                                                                                                                                  |
| 4. `produceOnly` is the default           | The orchestrator is a **function** on the runtime, so the safe mode constructs no client, needs no credential and no `prisma generate`.                                                                                     |
| 5. No background execution                | The run happens once, in the foreground, and returns. Nothing here has a scheduler.                                                                                                                                         |

### ⚠️ Do-not-undo list

- ⚠️ **What condition 2 does NOT prove.** A loopback host is a **necessary** condition, not a
  sufficient one: **an SSH tunnel from `localhost:5432` to a shared server is loopback and is exactly
  what D6 forbids.** 🚫 This must never be described as proving the target is the operator's own
  database. Both halves of that sentence must survive any summary.
- 🚫 **`openLocalPrismaCaptureConnection` is a SEPARATE function, not a flag** on
  `openPrismaCaptureConnection` — which `age-capture` and `ci-db.yml`'s live migration test still
  drive directly. A shared function with an `allowRemote` escape hatch would be the same rule with a
  documented way past it.
- 🚫 **Unparseable is not "probably fine."** Every path that cannot establish the host refuses.
- 🚫 **No credential is ever returned in an error.** The refusal names the **host** and nothing else;
  a connection string carries a password.
- ⚠️ **Order is load-bearing: the RECORD is resolved BEFORE the answers are read.** An unknown client
  id means the run has no scope at all, and a run with no scope has no business opening the
  operator's answer file. Asserted directly, not implied.
- 🚫 **The client's DISPLAY NAME is never echoed.** This CLI's output is the thing most likely to be
  pasted into an issue or a chat log.
- ⚠️ **One instant, not two.** The profile's `capturedAt`, the mapping's `constructedAt` and the
  snapshot's `capturedAt` all come from a single `runtime.now()`.
- 🚫 **`cli-argument-tokens.ts` must not be re-inlined into either parser.** It exists precisely so
  the two commands cannot drift (the §2 lesson, applied a second time).
- ⚠️ **The purity guard's `CORE_MODULES` array IS the coverage claim.** A module added to the CLI
  core but not to that array is a module the guard does not see.

### Guards MADE TO FAIL before being trusted

| Mutation                                         | Result   |
| ------------------------------------------------ | -------- |
| `assertLocalDatabaseTarget` made a no-op         | 6 failed |
| the `--organization-id` refusal removed          | 2 failed |
| answers read before the record                   | 3 failed |
| `new Date()` added to a newly-listed core module | 1 failed |

### ✅ Baseline unmoved

**98/63 intake vs 12/17 BIF**, band `strong`, **7 populated + 5 omitted**, `sample-output.txt`
byte-identical, 6 capabilities / 6 pending approvals / accounting invariant OK / no side effects.
156 tests in `@age/capture`.

---

## §5 — What this track does NOT claim

1. ⚠️ **The suite proves the SHAPE, not the run.** Every test drives an injected runtime. The actual
   write against the operator's own local database is **the operator's to perform**, and D7's
   falsification test is discharged only when they have performed it and read the row back.
2. 🚫 **A low score for the first real client is a CORRECT result** (D7). ⚠️ **Do not "help" it by
   touching a cap, a weight or a predicate.** ADR-0051's 35 cap was lifted by making the _evidence_
   real, not by moving the cap.
3. ⚠️ **The operator is still trusted.** A correctly-formatted but wrong `--client-id` yields a
   correctly-scoped write of the wrong client's data. Echo-and-`--confirm` reduces the fat-finger
   case; only an authenticated caller closes it.
4. 🚫 **No real client record or answer file is committed** (D3) — not redacted, not masked.
   **Private is not a control**, and **obvious fictionality IS the guard**: do not "make the
   fixtures more realistic".

---

## §6 — 🛑 THE STOPPING POINT (ADR-0054 §0.1d) — this is where the slice ENDS

The Product Owner's own condition, and it is not the architect's to relax:

> **"Stop" means stop.** The first true runtime caller is the **next** architectural phase and is
> **not** authorized by this ADR.

**The first end-to-end local onboarding flow is complete (#214, #215, #216, #217) and documented
(this file). Slice B is therefore DONE.** Anything beyond it — a runtime caller, an API or Web
surface, a second human, authentication, mcp-ads or RankOps — needs a **fresh `Status: Proposed`
ADR**, read in its own words. **Next ADR number is 0055.**

⚠️ **Recorded is not authorized.** ADR-0054 §5 is a record, not a to-do list.
