# ADR-0073 — The draft's durable home, now that the trigger has fired

Status: **Accepted** (2026-08-15) — **ADR-0067's option 2: the operator's own workspace.**
🚫 **NOT self-accepted.** ⚠️ This ADR exists because **ADR-0067's own named revisit trigger fired**,
and it was fired by the Product Owner, in the Product Owner's own words (§0.1).

Depends on: ADR-0067 (reopened here, 🚫 not weakened), ADR-0066 D3/D4 + §0.5a, ADR-0059 D1/D3,
ADR-0054 D2/D3, ADR-0053 D4, ADR-0050 D2, ADR-0046 D5.
Supersedes: 🚫 nothing. ⚠️ **It answers the question ADR-0067 deliberately left open** — which is
the one thing ADR-0067 said would happen next.

---

## 0.1 Why this ADR is allowed to exist at all

🛑 **ADR-0067 §0.1a named its own reopening condition and refused every substitute for it:**

> ⚠️ **The trigger for revisiting is named and is not a feeling:** a real operator hitting the
> limit on a real document. 🚫 Not "an operator might"; 🚫 not "twenty passages would be painful";
> 🚫 not a council predicting it.

The Product Owner has now stated the requirement directly, as a product instruction (verbatim):

> "Finish the currently authorized multi-answer draft implementation from ADR-0067 so a real
> operator can process a real PDF containing multiple answers without earlier confirmations
> disappearing. Prove the complete flow with a real PDF: document → multiple operator confirmations
> → accumulated draft → BIF → AGE reasoning → Studio. Do not weaken ADR-0067, ADR-0072, ADR-0069,
> ADR-0071 or any epistemic guard to make the flow work."

### 0.1a One correction, on the record

⚠️ **There was no "currently authorized" implementation to finish.** ADR-0067 §0.1d is explicit that
it authorizes **nothing** — no package, no schema, no migration, no file format, no screen. The
instruction is therefore read as what it is: **the Product Owner exercising ADR-0067's reopening
condition**, which is why this is a new ADR rather than a quiet extension of the last one. 🚫 The
architect did not decide the trigger had fired; the owner fired it.

### 0.1b 🚫 What this does NOT do to ADR-0067

- 🚫 **ADR-0067 is not weakened, overturned or called a mistake.** §0.1b of that ADR priced this
  exact outcome in advance — _"if the real session does prove the need, option 4 will have cost one
  slice of delay… a delay is recoverable, a second source of truth is not"_ — and 🛑 **that reasoning
  🚫 does not become wrong by being tested.** The delay was paid knowingly.
- ⚠️ **Option 2 was the architect's own stated follow-on** (ADR-0067 §4: _"Option 4, then option 2
  if a real session proves the need"_), so this is the pre-recorded next step, 🚫 not a new design.
- 🚫 **Option 3 (a tenant-scoped Postgres table) is STILL REFUSED and is not partly unlocked here.**
  It remains schema + migration + RLS — independently a §3 stop condition — and it would put a
  non-canonical artifact in the canonical store. 🚫 Choosing option 2 does not make option 3 nearer.

---

## 1. The decisions

### D1 — A confirmed answer's durable home is the operator's own discovery workspace

A source-confirmed answer is written to a file in the directory the operator already named
(`AGE_DISCOVERY_WORKSPACE`), beside the discovery draft and the Answer File that are already there.

- 🛑 **AGE never holds it.** The workspace is the operator's machine, outside the repository, and
  ADR-0054 D2/D3's path rules apply unchanged — 🚫 the path is never defaulted and never searched
  for.
- 🚫 **No schema, no migration, no RLS, no tenant question, no database.** That is the whole reason
  option 2 was preferred to option 3, and 🚫 it must not be "upgraded" later without reopening this.
- ⚠️ **This closes the Discovery-workspace asymmetry ON PURPOSE**, and only now. 🚫 It was refused
  before this ADR precisely because ease is not authorization.

### D2 — 🛑 It is a SEPARATE FILE from the Answer File, and the Answer File's parser is untouched

`<clientId>.source-confirmed.json`, beside `<clientId>.discovery-answers.json`.

- 🚫 **The Answer File stays `stated`-only** (ADR-0066 §0.5a, ADR-0067 §0.1c). It is hand-edited, so
  provenance recorded there would be a claim anyone can type. 🚫 There is still no "provenance
  column" and 🚫 the loader is not modified.
- 🛑 **The source-confirmed file accepts `confirmed-from-source` provenance and NOTHING ELSE.** An
  answer with any other provenance in that file is **refused on read**, 🚫 never downgraded and
  🚫 never re-labelled. The two channels stay two channels.
- ⚠️ **The file is hand-editable too — and that is not a loophole, it is the honest limit of option 2.** ADR-0067 §3 named this objection when it described option 2, and the owner chose it anyway.
  What the file cannot do is _become_ the Answer File or be read as one.

### D3 — 🚫 Persistence is still not acceptance, and the draft is still never canonical

- 🛑 **`@age/intake-draft` persists nothing and still must not learn how.** The reading and writing
  live in the operator-workspace orchestration and the console's single effect module — 🚫 not in
  the draft package, whose purity guard stays exactly as it is.
- 🛑 **`Draft → everything` stays impossible.** `draft-is-not-canonical.spec.ts` is unchanged:
  🚫 no scoring, BIF, capability or persistence module may import `@age/intake-draft`, and the
  hand-off is still plain `DiscoveryAnswer`s.
- 🚫 **A stored draft answer is still a candidate a human accepted from a source, never something
  AGE believes** (ADR-0066 D5). Durability changes where it sits, 🚫 not what it is.

### D4 — 🚫 A duplicate is still REFUSED, never overwritten — and durability makes that stricter

`recordAnswerInDraft` already refuses a second answer for the same question. 🛑 **Durability makes
an overwrite worse, not better**, because the destroyed origin is now a durable record: the refusal
stands, and 🚫 no "replace" affordance may appear on any screen from this ADR. Replacement is still
its own decision.

### D5 — The BIF is produced from BOTH intake channels, and an overlap is REFUSED

`generateBifFromAnswerFile` composes the Answer File's answers **and** the source-confirmed
answers into the one list `buildProfileAndFieldProvenanceFromAnswers` already takes.

- 🛑 **A question answered in BOTH channels is REFUSED, 🚫 never merged, and 🚫 neither channel
  wins.** Picking one would silently discard a recorded origin; merging would invent an answer
  nobody gave. ⚠️ This is the same rule as D4, applied across the two files instead of within one.
- 🛑 **AGE-INV-PROV-1 IS UNTOUCHED.** The provenance travels beside each answer and reaches the
  existing field-source view; 🚫 it does not reach any scorer, and identical facts with different
  provenance still score **byte-identically**. 🚫 The only permitted sentence remains _"Provenance
  alone never changes a score."_
- ⚠️ **A BIF produced from a partial intake is a `Draft` BIF with sections OMITTED** — the existing
  semantics, unchanged. 🚫 Nothing is placeholder-filled, and 🚫 a low score is a correct result
  (ADR-0054 D7).
- 🚫 **Still nothing is persisted by this path**, `produceAndCapture` stays unreachable from the
  console, and ADR-0046 D7 is not repealed.

### D6 — 🚫 Still no bulk acceptance, and no new inference

🛑 **ADR-0059 D1 is untouched: there is no "accept all" and there must never be one**, and 🚫 no
confidence threshold exists to compare against. Accumulation makes a _sequence_ of single human
acceptances durable; 🚫 it does not make one act cover many passages. ⚠️ The signatures stay the
enforcement: 🚫 no function gains a list of passages.

### D7 — The screen must say what is now true, and 🚫 must not say more

`DRAFT_STORAGE_STATE` gains a second arm, and the console's sentence changes with it.

- ⚠️ **"Not stored" must stop being printed the moment it stops being true** — a screen claiming a
  blocker the architecture has since removed is as dishonest as one claiming a capability that does
  not exist.
- 🚫 **The new sentence must not say "saved to AGE", "synced", "uploaded" or "shared".** It says
  where the file is, on the operator's own machine, and that AGE holds nothing.
- 🛑 **A write that fails is REPORTED, 🚫 never swallowed and 🚫 never rendered as an acceptance.**
  An acceptance the operator believes is durable and is not would be the worst outcome available
  here — worse than the evaporating draft this ADR replaces.
- 🚫 **The refusal and failure messages name a position, never contents** (ADR-0054 D3, ADR-0065
  D1). The workspace path is never printed to a screen.

---

## 2. What this ADR does NOT authorize

🚫 A draft table, a database, a queue, a cache, a session field or a hidden form value ·
🚫 any change to the Answer File format or its parser · 🚫 an "accept all", a threshold or any bulk
arm · 🚫 an overwrite or a "replace this answer" control · 🚫 any promotion of a draft to canonical ·
🚫 any new provenance kind, and 🚫 any default provenance anywhere · 🚫 a second effect module in
`apps/studio` · 🚫 anything on the peer, relay, decoder or observation tracks — ADR-0069, ADR-0071
and ADR-0072 are untouched by this ADR and 🚫 nothing here may be cited to move any of them.
