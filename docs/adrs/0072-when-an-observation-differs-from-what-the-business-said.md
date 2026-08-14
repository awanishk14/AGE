# ADR-0072 — When an observation differs from what the business said about itself

Status: **Proposed**
⚠️ **🚫 NOT self-accepted, and it authorizes nothing.** It decides how AGE may talk about a
difference between a relayed observation and the BIF — which is a claim about a real client's own
account of their business, made to their operator. The §2 mandate covers architecture; this is the
class of question the Product Owner has twice kept for themselves (ADR-0067, ADR-0070 D2).

Depends on: ADR-0069 **D1/D2/D5/D7** (a conclusion is authored by a deterministic rule · a computed
projection · arrival is never confirmation · two producers or it is not a conclusion),
ADR-0071 **§0.1b.3** (the owner's pre-recorded constraint on this gap), ADR-0026 **D4** (absence is a
limitation, never negative evidence), ADR-0011 (`detectContradictions`, structural only),
AGE-INV-PROV-1 (provenance alone never changes a score), and §3 of the working handover.
Supersedes: nothing. 🚫 It is **not** the ageing decision — that is gap C, and it gets its own ADR.

---

## 1. The question

`EI_01` gap B records what is already decided and what is not:

> Decided: two source systems that disagree are **reported as disagreement**; 🛑 AGE does not pick a
> winner by recency, materiality, source reputation or count. Undecided: what happens when a derived
> conclusion contradicts **the BIF itself** — what the business said about its own model.

The owner has already bounded the answer, in advance:

> The reportable fact is **"conflicting information exists"**, and it 🚫 must never become **"AGE has
> decided the BIF is wrong."** ⚠️ Not every difference is a contradiction — a peer reporting a
> decline in a market the BIF names is **agreement plus new information**, 🚫 not a conflict. The ADR
> must separate the two before it decides anything about the second.

🛑 **That constraint is taken as binding here, 🚫 not re-argued.** This ADR does the separation the
owner asked for first (§3 D1), and only then asks what may be said about whatever survives it.

---

## 2. What is true on `main` — measured, 🚫 not recalled

⚠️ Measured at `4c2405d`. **The measurement changes the question**, so it comes before the options.

- **An observation carries a directional claim.** `ObservationClaim` is
  `direction: 'up' | 'down' | 'flat' | 'absent'` plus `materiality: 'slight' | 'moderate' |
'substantial'`, over a named subject and a period.
- 🛑 **THE BIF CARRIES NO DIRECTIONAL CLAIM AT ALL.** `SUBJECT_SOURCES` in
  `@age/observation-association` is the entire mapping between the two worlds, and every entry reads
  a **label** out of a named section: `products`, `idealCustomerProfiles`, `personas`,
  `operatingCountries`, `longTermGoals`, and the three `Constraints` fields. What the BIF holds about
  a subject is **its name** — that this business has this service, serves this audience, operates in
  this country, holds this goal.
- 🛑 **THE CONSEQUENCE: THERE IS NO PAIR OF COMPARABLE ASSERTIONS TO CONTRADICT.** "The business
  operates in market M" and "market M declined last quarter" are 🚫 not opposites; they are a name
  and a movement. An observation and the BIF meet **only at subject identity** — the association
  either finds AGE's own label for the subject or reports the observation `unrelated`. Nothing in the
  relation is capable of being true-or-false against the other side.
- ⚠️ **`detectContradictions` IS NOT THE ANSWER HERE, AND MUST NOT BE REACHED FOR.** It compares
  `Evidence` to `Evidence` on `polarity` over a shared entity and target field (ADR-0011). It takes
  no BIF and no observation, it is **unwired with no import path**, and over an empty list it returns
  an empty set — which renders as "no contradictions" and turns _"AGE has never looked"_ into _"AGE
  checked and it is sound."_ 🚫 Wiring it to answer this question would produce exactly that sentence.
- **Disagreement between producers is already shipped and already honest.**
  `contested-directions` reports both observations, shows both contributors, and 🚫 breaks no tie.
  ⚠️ **That arm is not this gap** — it is source-vs-source, not source-vs-BIF.
- **Nothing in the derivation reads, writes or implies a BIF field, status, score or completeness
  figure**, by construction and by guard.

🛑 **So the real question is smaller and sharper than "who wins":** _is a difference between an
observation and the BIF representable in AGE at all today — and if it is not, is making it
representable a repair or a widening?_ 🚫 The "who wins" framing presupposes a conflict AGE currently
has no way to hold.

---

## 3. The decision requested

### D1 — The separation the owner asked for, before anything else

**Proposed:** AGE recognises exactly three relations between a relayed observation and the BIF, and
🚫 they are never collapsed:

| Relation                       | What it is                                                                                                                   | 🚫 What it is NOT                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Related**                    | The observation's subject matches a subject AGE holds. The observation adds a **movement** over something the BIF **names**. | 🚫 NOT agreement, 🚫 not corroboration, 🚫 not conflict. A decline in a market the BIF lists is **this**, and only this. |
| **Unrelated**                  | AGE holds no subject the observation matches. Already shipped; carried, 🚫 never discarded.                                  | 🚫 NOT "the business does not have this" — AGE not modelling a subject says nothing about the business (ADR-0026 D4).    |
| **Incompatible** _(undecided)_ | The observation asserts something that **cannot be true at the same time** as something the BIF states.                      | 🛑 The relation this ADR must decide whether AGE can hold at all. §2 says it currently **cannot be expressed**.          |

🛑 **"Agreement plus new information" is the default, 🚫 not the exception.** Every observation AGE
can relate today lands in **Related**, and 🚫 no count, streak, direction or materiality moves it into
Incompatible. ⚠️ A rule that promoted a run of `down` observations over a named market into a
conflict with the BIF would be AGE deciding the business's account of itself is wrong **by
accumulation**, which is the exact sentence §0.1b.3 forbids, arriving without anyone choosing it.

### D2 — Whether **Incompatible** becomes representable (🛑 the selection this ADR asks for)

⚠️ The options are **grounds**, 🚫 not the recommendation.

| Option                                                 | What it does                                                                                                                                                                                                                       | What it costs                                                                                                                                                                                                                                                   |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — not representable. Gap B closes as a decision.** | D1 ships; **Incompatible** is recorded as a relation AGE deliberately cannot express, because the BIF holds names and observations hold movements.                                                                                 | **Zero new semantics.** ⚠️ The cost is real: if a peer ever observes something that genuinely cannot coexist with the BIF, AGE will report it as ordinary new information. 🛑 The same shape ADR-0067 took — 🚫 it must not then be "fixed" by a helpful patch. |
| **B — absence-only incompatibility.**                  | The one comparison the current data supports: an observation whose `direction` is **`absent`** over a subject the BIF **names as present**. A source that **looked and found nothing** where the business said there is something. | Narrow, honest and buildable from shipped fields. ⚠️ But `absent` means _this source did not find it_, 🚫 not _it does not exist_ — the sentence must survive that, and a source with poor coverage would produce a conflict about **the source**.              |
| **C — capture the business's own directional claim.**  | Extend intake so the business states direction where it has one ("this market is growing for us"), giving a BIF-side assertion an observation can actually contradict.                                                             | The only option that makes conflict genuinely well-formed. ⚠️ It is a **discovery/intake change**, not an intelligence change — a new question, a mapper change, and its own slice. 🚫 It is not free, and 🚫 it is not this ADR's to write.                    |
| **D — a semantic comparison.**                         | Compare the observation's text against the BIF's text and judge compatibility.                                                                                                                                                     | 🛑 **This is a model call** (ADR-0059 D5, unresolved) **and an authored conclusion** (ADR-0069 D1, forbidden). Named so it is 🚫 not discovered later as a shortcut — it is listed to be refused, not chosen.                                                   |

**The architect's recommendation is A now, and C later on its own merits** — A because §2 measured
that AGE has nothing to compare, and B buys one narrow conflict shape at the price of a sentence that
is really about the source's coverage rather than the business. 🚫 **The recommendation is not the
decision, and 🚫 the owner selecting it would not be independent corroboration of it** (finding 7).

### D3 — What may be said, whichever option is chosen

**Proposed**, and 🚫 not conditional on D2:

- 🛑 **The reportable fact is "conflicting information exists", with both sides shown.** 🚫 Never
  "AGE has decided the BIF is wrong", 🚫 never "the observation is wrong", 🚫 never a correction, a
  suggested edit, a flag on the field or a prompt to update the BIF.
- 🚫 **NO SCORE, STATUS, FIELD OR COMPLETENESS FIGURE MOVES** (AGE-INV-PROV-1, ADR-0069 D5). A
  conflict is a thing to show a human, 🚫 not an input to anything.
- 🚫 **AGE DOES NOT PICK A WINNER HERE EITHER**, by recency, materiality, source reputation or count —
  the same refusal `contested-directions` already holds, extended to this axis.
- ⚠️ **Silence is labelled.** A screen that shows no conflicts must say AGE has looked and by which
  rule, or say it has not looked. 🚫 An unlabelled empty list reads as a clean bill of health, and
  that is this gap's specific failure mode.
- 🚫 **The relation is never carried to a peer** as anything but what it is. ADR-0071 D5 stands: the
  projection's shape is unchanged by the transport.

### D4 — What acceptance would 🚫 NOT authorize

🚫 Not wiring `detectContradictions`. 🚫 Not a model call. 🚫 Not an edit to any BIF field, section or
status. 🚫 Not a new persisted entity — anything derived here is a **computed projection** (D2 of
ADR-0069). 🚫 Not ageing, currentness or expiry — that is **gap C**, and letting it in here would let
age decide truth. 🚫 Not a notification, an alert, a queue or a scheduler. 🚫 Not a new intake
question — option C is a **separate slice with its own ADR**, and choosing C here authorizes the
direction, 🚫 not the code.

---

## 4. Why this is put to the owner rather than self-accepted

Deciding that AGE may say "this conflicts with what you told us" is deciding that a machine may
contradict a client's own account of their business, in front of the operator who has the
relationship with them. ⚠️ **The failure is not technical and would not be caught by a test:** a
conflict AGE reports too readily costs the operator's credibility with the client, and one it cannot
report at all costs the operator a fact they needed. 🚫 Neither cost is the architect's to choose.

⚠️ **Option A is a complete answer.** If gap B closes as "not representable, and the repair is
intake", that is a decision and 🚫 not a hole — and 🚫 it must not later be patched by a helpful rule.

---

## 5. Residual questions — 🚫 NOT a to-do list

Each needs its own `Status: Proposed` ADR, read in its own words:

1. **Gap C — ageing and currentness.** 🛑 Observation age ≠ observation validity. 🚫 Not answered here.
2. **Option C's intake question**, if C is chosen — what the business is asked, how the mapper carries
   it, and 🚫 how it stays a transcription rather than an inference (ADR-0050 D2).
3. **Where a conflict surfaces**, if any becomes representable — Intelligence, Contradictions, or
   neither. ⚠️ The `contradictions` area exists and is wired to something else; 🚫 do not assume it.
4. **Whether a source's own coverage is reportable** — B's `absent` case exposes it, and "this source
   did not look everywhere" is a fact about the peer, 🚫 not about the business.
