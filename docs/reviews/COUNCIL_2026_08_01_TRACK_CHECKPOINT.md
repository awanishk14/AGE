# Checkpoint — the four-lens council of 2026-08-01 and what it closed

> Durable record for PRs **#196, #197, #198, #199**. Extracted from `CLAUDE.md` when that file
> passed its size budget. **Nothing here is a to-do list.**
>
> Read §1 before convening another council; read §2–§4 before touching any guard named in them;
> read §5 before deciding what comes next.

---

## 1. Why the council was convened, and how

ADR-0050's track was complete and merged. The question was **what comes next**, and the governing
rule was **finding 11** — _"nothing is authorized" is usually about a TRACK, not the product_ —
so the brief was explicitly to **widen the frame**, not to pick from any recorded candidate list.

Four lenses: **architecture**, an adversarial **skeptic**, **sequencing**, and
**security-and-invariants**. Per **finding 13**, every lens was given the code and **none was given
my prose**. Per **finding 7**, findings were filtered on the way out — the lenses do not know the
repo's fences.

**The council split four ways, which is the useful outcome.** Per **finding 8**, evidence and
conclusion were adopted separately in three of the four cases.

### 1.1 What each lens picked

| Lens                        | Its pick                                                   | Outcome                                  |
| --------------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| **Skeptic**                 | ADR-0050 §3 makes a false reachability claim               | ✅ Upheld → **#196** (half rejected)     |
| **Security-and-invariants** | Three invariants have no enforcing test                    | ✅ Two closed → **#197**, **#198**       |
| **Architecture**            | The questionnaire cannot express what the profile requires | ➡️ **ADR-0051** (#199)                   |
| **Sequencing**              | Render the questionnaire as a `/discovery` form            | ⏸️ Evidence adopted, conclusion deferred |

### 1.2 The reusable lesson

⚠️ **Three of the four findings needed no ADR at all.** `CLAUDE.md` §3 and §5 had already decided
them; only their _enforcement_ was partial. **A stated boundary with a half-built guard is not a
decision gap** — it is a missing test, and writing an ADR for it would have been ceremony.

⚠️ **The collision that decided the ordering.** The sequencing lens's `/discovery` form would render
exactly the `calculateBusinessDiscoveryCompleteness` output that the architecture lens's 35-cap
governs. Shipped first, it tells every honest user _"confidence 35, partial"_ no matter how
completely they answer — and the obvious fix at that point is to soften the cap. Two independently
sound picks, in the wrong order, produce a bad decision neither lens recommended.

---

## 2. #196 — the ADR-0050 §3 erratum (the charge against my own work)

**Upheld.** ADR-0050 §3 claimed ADR-0049's profile parameter had _"a second **reachable**
argument"_ and that _"the pipeline **can be pointed at a real business by a human**."_ Both false:

- `buildProfileFromAnswers` has **zero non-test callers** — verified directly, not on report.
  **Constructible is not reachable**, and the ADR should have said so.
- No form, route or CLI flag accepts an answer set, so **no human can point anything anywhere**.

This is the same class of overclaim ADR-0049 D2 exists to prevent, **committed in the ADR that
closed it**. Corrected in place with an erratum; D1–D8 are unaffected.

### ⚠️ The half that was REJECTED — do not act on it

The skeptic further charged that `apps/demo/src/tests/run.spec.ts`'s
`runBusinessDiscoveryIntake(DEMO_BUSINESS_DISCOVERY_PROFILE, …)` regex is _"the artefact defending
falsifiability … preventing it."_ **It is not.** That guard pins **one caller** — the demo CLI — to
naming its subject at the call site, which _is_ ADR-0049 D2. It constrains the demo, not the
function. **Do not loosen it** on the strength of the erratum; the erratum says so in the ADR.

---

## 3. #197 — the `@age/bif` capability ban, guarded in 3 of 6 packages

`CLAUDE.md` §3 states it plainly: **capability packages must never import `@age/bif`.** It was
enforced only in `intelligence`, `market-discovery` and `revenue` — the three ADR-0027 adopters.
`growth`, `authority` and `operations` asserted nothing, across 18 spec files. Half the capabilities
could have taken the import with every suite green.

Now one guard in **`@age/capability-kit`** walks the **capabilities directory rather than a list**,
so a seventh capability is covered on the day it is created. It checks both halves: no `@age/bif` in
any manifest's `dependencies`/`devDependencies`, and no `@age/bif` import in any capability source.

- ⚠️ It does **NOT** replace the three per-package boundary blocks, which assert further
  capability-specific things. **Deleting them is not made safe by this file.**
- ⚠️ **Comments are stripped before scanning.** `intelligence` discusses `@age/bif` in prose
  _precisely because it must not import it_ — without the strip the guard fails on the file that
  documents the rule, and would then have been deleted. A fourth test pins the strip is load-bearing.
- **Mutation-proved** in both previously-unguarded packages: an import in `growth`, a dependency in
  `authority` → exactly the two scanning tests failed and **named the offending file and package**.

---

## 4. #198 — append-only had no committed source guard

Three strong enforcers with a hole between them:

| Enforcer                                                | What it stops                                 |
| ------------------------------------------------------- | --------------------------------------------- |
| `ScoredBifSnapshotDelegate` omits every mutating method | Mutation **through the adapter** (type-level) |
| Migration grants `SELECT, INSERT` only; RLS `FORCE`s    | The `age_app` role, **at the database**       |
| `scored-bif-snapshot-rls.db.spec.ts`                    | Proves both, live                             |

**The hole:** a package holding a real `PrismaClient` can call `prisma.scoredBifSnapshot.update(...)`
**directly** — it never touches the narrow adapter, so the type system permits it, and `ci-db.yml`
is path-gated to `packages/persistence/**`, `packages/scored-bif-snapshot-persistence/**` and
`apps/capture/**`, so a call written anywhere else never reaches the live privilege tests either.
Such a change **merges green** and fails in production against a database whose owner-role grants
may have drifted — on a table where a bad row _"cannot be corrected or removed through the
application at all."_

Now scanned repo-wide (**>900 `.ts` files** under `packages/` + `apps/`), plus a pin that the
delegate interface keeps **exactly** `create`, `findUnique`, `findMany`.

### ⚠️ Four details that must survive any summarizing

1. **Widening `ScoredBifSnapshotDelegate` IS the mutation** — the interface's own docblock already
   said it would need its own ADR; now a test enforces it.
2. **The scan is receiver-scoped** (`snapshot|delegate|prisma`) **on purpose.** A blanket `.delete(`
   ban fires on every `Map.delete` in the repo, and **a guard that cries wolf is a guard that gets
   deleted.** `createMany` is excluded: inserting is the one write this table allows.
3. **The non-vacuity fixtures are assembled from parts, not written literally**, so the guard file
   stays **inside its own scan**. A literal would make it flag its own fixtures — and the obvious
   fix, skipping the file, carves out the one place a violation could then hide.
4. **The interface slice is bounded at its own closing brace.** Unbounded it swept up
   `isUniqueConstraintViolation`'s body and reported a phantom `return` method.

**Mutation-proved**: a `deleteMany` planted in `packages/capabilities/growth` — **a package
`ci-db.yml` never gates** — plus an `update` on the interface → exactly the two enforcing tests
failed and named both.

### ⚠️ A correction to my own method, worth carrying forward

A `grep -E` used to pre-verify the repo was clean **silently mis-handled `\s`** and reported zero
hits for a reason unrelated to the repo. The JS scan found the truth — clean, but not for the reason
the grep gave. **"I grepped and found nothing" was nearly the evidence this guard was unnecessary.**

---

## 5. #199 — ADR-0051, and what remains

**`Status: Proposed`.** Full text: `docs/adrs/0051-the-questionnaire-cannot-say-what-the-profile-requires.md`
— read it, do not re-derive it, and do not convene another council on it.

Its four verified facts, its load-bearing D2 (the enum is declared on the **question**, never derived
from the **answer**) and its D5 ordering ruling are summarized in `CLAUDE.md` §1. The two dissents
are recorded in §4 of the ADR and **were not dissolved** — including the skeptic's standing
objection that every slice on this track has ended with the function still uncalled, which the ADR
concedes is the **last** deferral that argument can carry.

### 5.1 What is left on this track

- **ADR-0051 must be accepted** (a separate PR flipping `Status`), then D1–D4 implemented.
- **ADR-0051 §2.1's five recorded items** are **recorded, not authorized**. Each needs its own
  `Status: Proposed` ADR. The one with the clearest argument for acting early is the **API
  hardening ordering** — the security lens argues `apps/api`'s bare `app.enableCors()`, absent
  `ValidationPipe` and absent body limit should land **before** any route rather than with it.
  Blast radius today is near zero (**every controller is `@Get`-only; zero `@Post`/`@Body` in the
  app**), which is exactly why it is cheap to do first.
- **Nothing else from this council remains open.**
