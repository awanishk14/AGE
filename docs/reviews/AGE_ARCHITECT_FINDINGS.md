# AGE — Findings Worth Carrying Forward

> Extracted **verbatim** from the untracked working-memory handover (`CLAUDE.md` §6) on
> **2026-07-31**, when that file exceeded its ~30k-char budget. Its own rule: _extract a durable
> section into a tracked doc and leave a pointer — never just append_, and _extract verbatim first,
> then summarize, so the prune cannot lose a "do not undo" detail._
>
> ⚠️ **The numbering is load-bearing.** Accepted ADRs and the handover cite these by number
> (e.g. "§6.7", "finding 8"). **Append new findings; never renumber, never reorder, never delete.**
> A retired finding is marked retired in place, with the reason.
>
> ⚠️ **Numbers are written as headings, not as a Markdown ordered list, deliberately.** The first
> draft of this file used a numbered list broken up by topic headings, and **Prettier silently
> renumbered it** — 10→6, 11→10, 12→11, 13→12 — because each heading restarts a list. Headings make
> the numbers literal text no formatter can rewrite. **Do not convert this file back to a list.**
>
> These are hard-won corrections, most of them recording a mistake that was actually made. They are
> not style preferences.

---

### Finding 1 — `jsonb` does NOT round-trip byte-for-byte

PostgreSQL re-serialises; keys come back ordered by length then bytes. Values exact, text not.
Nothing downstream cares — `serializeScoredBifSnapshot` sorts keys itself.

### Finding 2 — `prisma:validate` failing locally with P1012 is ENVIRONMENTAL, not a regression

`pnpm --filter @age/persistence prisma:validate` fails locally with "Environment variable not found:
DATABASE_URL". Any dummy value makes it pass; `ci-db.yml` sets it.

### Finding 3 — The adapter is not the boundary against a caller that fabricates a key

It derives scope _from_ the key, so the two cannot disagree by construction. What holds the line is
the key's ids coming from `ClientContext` — #151 supplied the scope-establishing layer and #156 the
composition root above it, but an **authenticated** source of those ids still does not exist (see the
D4 residual). The DB's narrower guarantee is intact and proven by the raw-SQL RLS tests.

### Finding 4 — ADR-0041 open question 1: one conversion is unremovable

`ScoredBifContextField.value` is `unknown`, so no type-level projection can prove JSON-safety.
Narrow, documented, at the mapper only (`scored-bif-snapshot-row.ts:81`), after runtime validation.
**Not** a blanket suppression.

### Finding 5 — Three recurring test-bug shapes

Each was tests-wrong-not-code: `this.snapshots` appears twice (constructor assignment + facade
construction); an in-memory adapter's internal `series` property is visible through a `get` proxy but
is not a port operation; doc comments legitimately _name_ forbidden symbols — **strip comments before
scanning source**.

### Finding 6 — Per-capability thresholds stay per-capability

All three adopters independently chose 50/50/70 but apply them to **different section shapes** — the
match is superficial, so per-capability thresholds stand. If ever revisited, share the _shape_, not
the integers.

### Finding 7 — A reviewer handed my prose launders my errors back as confirmation

(ADR-0044 §0.1) The sequencing lens was given the #152 options report and repeated my own false claim
back to me as independently established. Two of that report's claims were overturned on evidence, so
`docs/reviews/ADR0043_SNAPSHOT_CONSUMER_OPTIONS.md` is **not authoritative** where it conflicts with
ADR-0044. Give council lenses the **code** on factual questions.

### Finding 8 — A lens can be right about every fact and wrong about what to do with them

(ADR-0045 §0.1) The two lenses whose factual work was strongest — they found the CI-superuser RLS
bypass and the vitest-glob collection rule — both recommended the one action the ADR rejects.
**Adopt a council's evidence and its conclusion separately;** never let strong findings buy a weak
recommendation.

### Finding 9 — A revisit trigger the architect can satisfy on demand is not a gate

(ADR-0045 D2) ADR-0044 §4's trigger was worded so its _letter_ was satisfiable in an afternoon by
writing a spec. Half the council proposed exactly that. When writing a trigger, state **who may
author the evidence** — and narrow it _before_ someone satisfies the letter, never after.

### Finding 10 — Verify "is this untested?" before building a test for it

(ADR-0045 C1) The handover and an Accepted ADR both understated existing live coverage, which nearly
bought a redundant slice. Multi-member series ordering/tie-break/`findLatest` were already proven,
twice.

### Finding 11 — ⚠️ "Nothing is authorized" is usually a statement about a TRACK, not the product

(ADR-0046 D2) Three consecutive ADRs searched for the next move inside the same subsystem; ADR-0045
D6's candidate table listed six candidates and **all six were on the persistence track**. The track's
momentum, not its value, kept generating the next question. **When a track reports itself blocked,
widen the frame before believing it** — the highest-value gap was two packages away and gated by
nothing.

### Finding 12 — A council lens that is always negative has stopped being a lens

(ADR-0046 §0.2, the skeptic's own charge) The remedy is not to discount it — its reasoning may be
sound, as it was on D1 — but to notice that repeated "record, don't build" outcomes indicate a
**framing** problem. If the next council also produces "record, don't build", escalate the
**governance** question, do not re-derive the same conclusion a fourth time.

### Finding 13 — ⚠️ Council lenses do not know the repo's out-of-scope fences

They are given code + ADRs only, by design. One inspected PR #26 despite it being declared
untouchable. **Sanitize what comes back:** record such findings as second-hand and unverified, and do
not act on them. The prose-withholding rule (finding 7) and the fence rules are in tension;
withholding wins, so filter on the way out.

---

## Reading order

- **Before convening a council:** findings 7, 8, 12, 13 — each records a way a council has actually
  misled this project.
- **Before writing a revisit trigger or an ADR that defers work:** findings 9, 11.
- **Before building a test:** findings 5, 10.
- **On tenant scope and persistence:** findings 1, 3, 4.

## How to add a finding

A finding earns a place here when it records something that **was actually got wrong**, or a fact
that **cost real effort to establish and would be re-derived otherwise**. Append with the next
number as a new `### Finding N — …` heading, cite the ADR or PR that produced it, and state the
corrective action in the imperative — what a future reader should _do_, not merely what is true.
