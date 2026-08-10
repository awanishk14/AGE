# ADR-0067 — Where a draft answer lives, if it lives anywhere

Status: **Accepted** (2026-08-11) — **option 4: not yet, and say so.** See §0.1.
🚫 **NOT self-accepted, and 🚫 nothing here authorizes code.** It was raised as a decision request
because ADR-0066 D4's acceptance deliberately left the question open. ⚠️ **The answer is that the
question stays open on purpose** — 🚫 which is not the same as unanswered.

Depends on: ADR-0066 D4 + §0.5a, ADR-0059 D1/D7, ADR-0062 D1–D3, ADR-0046 D5, ADR-0055 A2.
Supersedes: nothing.

---

## 0.1 The Product Owner's answer (2026-08-11)

⚠️ **This ADR was 🚫 NOT self-accepted.** §3 was put to the Product Owner as the question it was
written to be. ⚠️ **The answer was given as a selection from the four shapes §3 offered, 🚫 not as
free prose**, so what is recorded below is the selected option quoted **verbatim as the owner read
it**. 🚫 It is not a paraphrase.

**Where does a draft answer live between requests? → option 4:**

> **Not yet — and say so.** Keep option 1, and revisit only when a real operator has actually hit
> the limit on a real document. The cost of deciding late is a slice; the cost of deciding wrong
> is a second source of truth.

### 0.1a What this decides — and 🚫 what it is not

- 🛑 **A draft answer lives NOWHERE between requests, and that is now a DECISION, 🚫 not a gap.**
  The shipped shape stands exactly as slice 4 built it: `storage: 'not-stored'`, the screen saying
  **"Not stored."**, and each acceptance starting from an empty draft.
- 🚫 **This is not a deferral dressed as an answer.** ⚠️ The difference matters for the next
  reader: a **gap** invites a helpful patch, whereas a **decision** must be reopened deliberately.
  🚫 Do not "fix" the evaporating draft with a file write, a cache, a module-level variable, a
  session field or a hidden form value. Each of those is option 2 or 3 arriving without an ADR.
- ⚠️ **The trigger for revisiting is named and is not a feeling:** a real operator hitting the
  limit on a real document. 🚫 Not "an operator might"; 🚫 not "twenty passages would be painful";
  🚫 not a council predicting it. ⚠️ Until that has actually happened, the pressure is
  **hypothetical** (finding 11), and 🚫 the architect may not treat his own §1 sentence — _"an
  operator cannot accept twenty passages across twenty minutes if each one evaporates"_ — as the
  evidence. It was the reason to **ask**, 🚫 not an observation of anyone working.

### 0.1b The dissent, recorded because it was real

⚠️ §4 recorded the dissent against its own recommendation and the owner chose the recommendation
anyway, so the dissent stands on the record rather than being resolved by the vote:

> ⚠️ **The dissent worth recording:** option 2 costs little and might have been chosen now, and if
> the real session does prove the need, option 4 will have cost one slice of delay. That is
> accepted deliberately — a delay is recoverable, a second source of truth is not.

⚠️ **If the real session does prove the need, that delay was the price of this decision, 🚫 not a
mistake to be discovered and blamed.** It was paid knowingly, and the reason — a delay is
recoverable, a second source of truth is not — 🚫 does not become wrong by being tested.

⚠️ **And as with ADR-0068 §0.1a: the owner selected the architect's own recommendation from shapes
the architect wrote.** 🚫 That agreement is not independent corroboration (finding 7).

### 0.1c What is still true, unchanged

- 🛑 **The draft never becomes canonical** (ADR-0066 §0.5a). §2 is untouched by this acceptance,
  and `packages/intake-draft/src/tests/draft-is-not-canonical.spec.ts` keeps guarding it
  structurally. 🚫 No exception to `CANONICAL_AREAS`.
- 🚫 **`@age/intake-draft` persists nothing and must not learn how.** ⚠️ This acceptance is the
  reason that sentence stays true, 🚫 not a licence to revisit it.
- 🚫 **The Answer File stays `stated`-only, its parser untouched**; 🚫 a duplicate answer is still
  **refused, never overwritten**; 🚫 storing a draft would still not be accepting it.
- ⚠️ **Option 3 is NOT partly unlocked by ADR-0068.** ADR-0068 §0.1b crossed the §3 schema stop
  condition for **the session store only** and said so by name. 🚫 A draft table is a separate
  decision and would need this ADR reopened plus its own §3 clearance.

### 0.1d What this authorizes

🚫 **Nothing.** No package, no schema, no migration, no file format, no screen. ⚠️ It is a decision
**not** to build, which is the one kind of decision that ships by leaving the code alone. 🚫 There
is no slice to schedule from this ADR, and 🚫 an empty follow-up is not owed.

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

> ⚠️ **ANSWERED 2026-08-11 — read §0.1.** The owner chose **option 4**, so the paragraph above is
> the record of why the question was raised, 🚫 not a live claim that it is open. ⚠️ The sentence
> _"it is not a usable shape tomorrow"_ was the architect's **reason to ask**; §0.1a is explicit
> that it is 🚫 **not** evidence any operator has hit the limit, and 🚫 may not be cited as though
> it were.

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
