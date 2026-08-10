# ADR-0067 — Where a draft answer lives, if it lives anywhere

Status: **Proposed** (2026-08-10). 🚫 **NOT self-accepted, and 🚫 nothing here authorizes code.**
This is a decision request, raised because ADR-0066 D4's acceptance deliberately left it open.

Depends on: ADR-0066 D4 + §0.5a, ADR-0059 D1/D7, ADR-0062 D1–D3, ADR-0046 D5, ADR-0055 A2.
Supersedes: nothing.

---

## 1. Why this ADR exists

ADR-0066 §0.5a accepted D4 **with a binding clarification**: `@age/intake-draft` is a working
artifact, it **persists nothing**, and it **must not learn how**. The Product Owner kept durable
draft storage out of D4 on purpose.

Slice 4 has now shipped the consequence, visibly and honestly:

- an operator can name a plain-text document, see its own sentences verbatim, and record one of
  them as the answer to one question, with a complete `confirmed-from-source` provenance;
- and the moment the request ends, **that acceptance is gone**. The screen says so in words
  ("Not stored."), and the outcome carries an explicit `storage: 'not-stored'` so no surface can
  imply otherwise.

That is the correct shape today. It is not a usable shape tomorrow: an operator working through a
real document cannot accept twenty passages across twenty minutes if each one evaporates. So the
question the owner deferred is now the question in the way.

⚠️ **This ADR asks the question. It does not answer it, and it does not build anything.** Schema,
migration and RLS are independently a §3 stop condition.

## 2. What is NOT in question

- 🛑 **The draft never becomes canonical.** Whatever is decided here, `Draft → everything` must
  still be impossible: no reader may prefer the draft because it is closer, no screen may render it
  because it is richer, no capability may take it because it is already loaded. ADR-0066 §0.5a is
  not reopened by this ADR, and `packages/intake-draft/src/tests/` continues to guard it
  structurally. 🚫 Do not add an exception to `CANONICAL_AREAS`.
- 🚫 **The Answer File stays `stated`-only and its parser stays untouched.** It is hand-edited, so
  provenance recorded there would be a claim anyone can type. 🚫 There is no "provenance column".
- 🚫 **A duplicate answer is still refused, never overwritten** — an overwrite destroys a recorded
  origin, and durability makes that worse, not better.
- 🚫 **Storing a draft is not accepting it.** Persistence must not become an implicit promotion
  path: a stored draft answer is still a candidate a human accepted from a source, never something
  AGE believes (ADR-0066 D5).
- ⚠️ **RLS is a coherence constraint, not an authorization boundary** (ADR-0046 D5). If a store is
  chosen, that stays true, and 🚫 the store must not be described as making the draft "safe".

## 3. The question for the Product Owner

**Where — if anywhere — does a draft answer live between requests?**

Four shapes, and the fourth is a real answer, not a placeholder:

1. **Nowhere. It stays exactly as it is today.** The operator accepts passages and then commits
   them onward within one sitting. Honest, cheap, already shipped — and possibly unusable for a
   real document of real length.
2. **The operator's own machine**, alongside the discovery draft file the operator already owns
   (`DISCOVERY_WORKSPACE`, outside the repository). No schema, no migration, no RLS, no tenant
   question — the draft is the operator's working file, and AGE never holds it. But it is a second
   file format to parse, and a hand-editable one, which is precisely the objection that keeps
   provenance out of the Answer File.
3. **A tenant-scoped Postgres table**, append-only, alongside the snapshot store. Durable, shared
   between two operators (which slice 7 will want), and the only option that survives a second
   human — but it is schema + migration + RLS, a §3 stop condition, and it puts a non-canonical
   artifact in the same database as the canonical one, where a later reader may confuse them.
4. **Not yet — and say so.** Keep option 1, and revisit only when a real operator has actually hit
   the limit on a real document. The cost of deciding late is a slice; the cost of deciding wrong
   is a second source of truth.

## 4. The architect's recommendation

**Option 4, then option 2 if a real session proves the need.**

Reasoning, and the dissent against it:

- The pressure for durability is currently **hypothetical**. No operator has yet worked a real
  document through the Sources screen. Finding 11 applies: a track that reports itself blocked is
  usually blocked on something other than what it names. The honest test is one real session.
- Option 3 is the one that carries the most architecture and the most risk of exactly the drift
  §0.5a names — a working artifact sitting in the canonical store, one convenient join away from
  being read as truth. It should not be chosen before a second operator exists to need it, and
  slice 7 is gated on the session store rows anyway.
- ⚠️ **The dissent worth recording:** option 2 costs little and might have been chosen now, and if
  the real session does prove the need, option 4 will have cost one slice of delay. That is
  accepted deliberately — a delay is recoverable, a second source of truth is not.

## 5. What this ADR authorizes

🚫 **Nothing.** No package, no schema, no migration, no file format, no screen. If the owner picks
option 2 or 3, that choice needs its own slice, and option 3 additionally needs its own §3
clearance.
