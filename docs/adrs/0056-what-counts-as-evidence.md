# ADR-0056 — What counts as evidence

Status: Proposed
🛑 **The required council has RUN and REFUTED D1 and D2 (§0.1e). The architect adopts the refutation
and recommends REJECTING D1 and D2 while keeping D3–D7.** The decision text in §2 is left standing
unamended so the proposal can be read against what was found; it is a record of a rejected proposal,
not a live recommendation. The decision remains the Product Owner's.
Date: 2026-08-02
Relates to: ADR-0010 (`@age/evidence-contracts` owns the evidence enums; RIE is a producer, not the
owner), ADR-0011 (the deterministic quality score this ADR is asked to change), ADR-0026 D4
(**absence is a limitation, never negative evidence**), ADR-0027 D1 (readiness reports context, never
a business conclusion), ADR-0046 D7 (no capture writes), ADR-0053 D3 (**real client records are never
committed**), ADR-0055 §5 item 5 and its "next number is 0056".

---

## 0. How this decision was reached

### 0.1 Standing

Written under the standing architect grant recorded in ADR-0043 §0.1.

🚫 **This ADR is `Status: Proposed` and MUST NOT be self-accepted.** It changes a published enum in
the Bible's data dictionary (D6), which is Product Owner territory: the precedent is PR #209/#211,
where the peer-product model was amended only after a Product Owner comment on the open PR, not by
the architect merging their own reading. **The Product Owner accepts, amends or rejects this in their
own words.**

### 0.1a Why this ADR exists at all — the code asked for it, by name

This is not an architect-invented refinement. `packages/capabilities/intelligence/src/processing/
score-evidence-quality.ts` opens with a standing request, written by the session that implemented
ADR-0011 and left in the source ever since:

> **DECISION FLAGGED, NOT IMPLEMENTED:** per-source reliability tiers (e.g. weighting G2 review
> evidence differently from a forum post) are intentionally NOT part of this formula. No ADR,
> contract, or frozen spec defines a reliability ranking across `EvidenceSource` values, and
> inventing one here would be a business judgment call outside this task's scope. If source-tier
> weighting is wanted, it needs an explicit product decision (ideally its own ADR) defining the
> ranking before it can be implemented.

That is a correctly-refused decision, parked in the one place a future implementer would look. This
ADR is the answer it asked for — **and D1 below declines the ranking it offered.**

### 0.1b What was verified, and what was NOT

Every claim in §1 was read out of the code on 2026-08-02, not carried over from a prior session's
summary. Two things the session's own working notes asserted turned out to be **false on inspection**
and are corrected here rather than quietly dropped:

1. **"ADR-0055 is the free number."** It is not — `0055-the-row-nobody-reads.md` is committed on
   `main` (`deb5a2b`) and is an unrelated decision about a read-only `inspect` subcommand. Writing
   this ADR as 0055 would have overwritten a `Proposed` decision awaiting the Product Owner.
2. **"Doc 11 (`11_INTEGRATION_CATALOG.md`) needs amending."** It does not mention `EvidenceSource`,
   `REDDIT`, `G2` or `TRUSTPILOT` at all. The Bible amendment surface is **one file**, narrower than
   assumed. D6 is scoped to what actually exists.

⚠️ **No council was convened before this ADR was first written.** The operating mode calls for one on
high-blast-radius decisions, and an enum in the published data dictionary qualifies. This ADR is
docs-only and self-blocking (D7 forbids implementation before acceptance), so the cost was bounded —
but it was a **departure, recorded here rather than concealed**. §0.1d now closes it.

### 0.1c The dissent the architect could not resolve

**D2 adds two enum members whose producers do not exist.** `QUESTION` and `ENGAGEMENT` describe
signals that arrive from social and community surfaces AGE cannot currently read — there is no
adapter, no ingest endpoint, and D7 forbids building one. A reasonable objection is that an enum
member no producer can emit is the same defect ADR-0055 is named after: a row nobody writes.

The counter-argument: the enum is a **published contract in the data dictionary**, and contracts are
amended before producers, not after — the alternative is that the first adapter's author invents the
vocabulary under delivery pressure, which is exactly how the units bug in RankOps ADR-0033 happened.

⚠️ **This section's original verdict — "narrowly stronger, but not decisively so", applied to both
members equally — is SUPERSEDED by §D2.1**, which was written when the Product Owner asked for the
timing argument in full. Working it through split the two: `ENGAGEMENT` survives the objection on
structural grounds, `QUESTION` does not. 🛑 **§D2.1 IS ITSELF NOW SUPERSEDED BY §0.1e — the council
refuted both members and reversed the split. Read §0.1e for the current position.**
The superseded verdict is left standing rather than deleted, because an objection that was once
answered too easily is itself worth seeing. **Still recorded unresolved** — §0.1d hands it to a
council.

### 0.1d — A council on D1 and D2 is a PRECONDITION OF ACCEPTANCE

Product Owner direction, 2026-08-02, on the first draft of this ADR:

> **"The lack of council review is acceptable for now, but before acceptance I'd like a council pass
> specifically on D1 and D2 because enum changes become long-lived contracts."**

🚫 **This ADR MUST NOT be accepted — by anyone, including the Product Owner acting on the architect's
summary — until that council has run and its dissent is recorded here.** The reason is in the
direction itself: an enum in a published contract outlives the slice that introduced it, and D1's
four-class carve-up and D2's two members are exactly the kind of decision that looks obvious to one
reader and arbitrary to a second.

Scope of the required council, deliberately narrow:

1. **D1's classes** — do `SOLICITED_REVIEW` / `PUBLIC_DISCUSSION` / `VENDOR_CONTROLLED` /
   `INDEXED_ARTIFACT` carve the 12 sources at a joint, or is the split an artefact of how the
   architect happened to group them? Specifically: is `YOUTUBE` public discussion or a vendor-
   controlled channel — it is routinely both? Is `GITHUB` an indexed artefact or a public discussion?
   ⚠️ **A source that plausibly belongs in two classes is evidence the classes are wrong**, not a
   tie to be broken by the architect's preference.
2. **D2's two members**, against §D2.1's own counter-argument. The brief must be **refuting**: the
   lens is asked to argue that the members should wait for a producer, not to confirm them.
3. **Neither** — no council time on D3–D7, which are boundaries and deferrals rather than contracts.

⚠️ Per finding 7, the lenses get **the code and the enum**, never this ADR's prose — otherwise the
architect's reasoning returns as independent confirmation of itself. Per finding 8, the evidence and
the conclusion are adopted **separately**.

### 0.1e — THE COUNCIL HAS NOW RUN. IT REFUTED D1 AND D2.

Ran 2026-08-02, three lenses, refuting briefs, each given the code and the enum and **not** this
document (finding 7). Verdicts: **REFUTE** (classification), **REFUTE** (members), and
**PROCEED-MODIFIED** (contract-evolution — but on mechanics only, explicitly not on whether either
change is _right_).

🛑 **The architect adopts the refutation. D1 and D2 as drafted below should NOT be accepted.** The
decision text in §2 is left standing **unamended** so the Product Owner can read what was proposed
against what was found; it is now a **record of a rejected proposal**, not a live recommendation.

I re-verified every load-bearing claim in the code rather than taking the lenses at face value
(finding 8 — evidence and conclusion adopted separately). All four hold:

| Claim                                                      | Verified at                                                   | Holds |
| ---------------------------------------------------------- | ------------------------------------------------------------- | ----- |
| `polarity` is **required** on every signal                 | `evidence-contracts/src/extracted-signal.ts:11`               | ✅    |
| `strength` is a bounded `0–100` quality figure             | `extracted-signal.ts:9-10`                                    | ✅    |
| `ExtractedSignal.type` is already plain `string`           | `extracted-signal.ts:5`                                       | ✅    |
| equal `signalType` is a **precondition** for contradiction | `detect-contradictions.ts:42`                                 | ✅    |
| `EvidenceSourceKind` already exists as a 3rd taxonomy      | `business-discovery-contracts/src/enums.ts:49`                | ✅    |
| `"reserved"` has **no precedent** in the data dictionary   | `grep -c reserved docs/product/05_DATA_DICTIONARY.md` → **0** | ✅    |

**Against D1 — the four classes are drawn from four different axes.** `SOLICITED_REVIEW` is an
elicitation mode, `PUBLIC_DISCUSSION` a venue, `VENDOR_CONTROLLED` a control relationship, and
`INDEXED_ARTIFACT` a _retrieval method_. A partition whose cells answer four different questions is
not a joint in the domain. `INDEXED_ARTIFACT` is the tell: it holds exactly the two members that
resisted the other three — a residual bucket dressed as a peer class. `GOOGLE_SEARCH` is not a source
at all but a retrieval method, and inherits the class of whatever it surfaced.

The soft spot named in §0.1d was understated. **Seven of twelve** members admit two or more classes,
not two: `YOUTUBE`, `GITHUB`, `SOCIAL`, `GOOGLE_SEARCH`, `FORUM` (a vendor-hosted forum is
vendor-controlled by D1's own criterion), `ADS`, `JOB_POSTING`. The five that classify cleanly do so
because they name _one site with one dominant use_, not because the axis is sharp — the root cause is
that `EvidenceSource` is itself heterogeneous, mixing named platforms, venue archetypes, artefact
genres and one retrieval method. ⚠️ **No single-axis partition can be clean over a set that is not
itself of one kind.**

An equally defensible authorship axis (subject / customer / third-party) was mapped across all 12 and
scores no better — **and disagrees with D1 on four of twelve members.** Two honest axes producing
different answers on a third of the enum is the operational definition of an arbitrary carve-up.

The origin-not-trust disclaimer also does not survive contact with the names. "Controlled" is a
caution word, not a description of an act; the neutral term is `SELF_PUBLISHED`. Read down the list
and it is a descending independence ladder. And the only nameable consumer of a source class is
weighting — which `score-evidence-quality.ts:7-13` forbids without its own ADR. **D1 supplies the
vocabulary for exactly the ranking it disclaims.**

**Against D2 — and this reverses §D2.1.** I argued there that `ENGAGEMENT` survives on structural
grounds and `QUESTION` does not. **That is backwards, and the code says so:**

- `SignalType` is defined as _"the kind of signal a piece of evidence carries"_ — every one of the 10
  members is a **speech act with a stance**. `ENGAGEMENT` is a measurement, which §D2.1 treated as the
  argument _for_ it. It is the argument _against_ it.
- Worse, it is actively harmful in shipped code. `polarity` is required, so an engagement record must
  invent one. Two `ENGAGEMENT` records on the same `targetField` — a 5-reply thread and a 500-reply
  thread — differ in magnitude, not in claim; with invented opposing polarity,
  `detect-contradictions.ts:42` reports a **false contradiction between two correct measurements**.
- And it does not even house the number. `strength` is a bounded 0–100 quality figure; a reply count
  is unbounded. Engagement is dimensional data with **no correct home in the contract** — a 12th enum
  member gives it a label and nowhere to put the value.
- `QUESTION` fails differently and more softly: its definition bundles interrogative _form_ with an
  unanswered-ness _judgement about the subject_ that a sensing layer which "never modifies BIF" is not
  positioned to make. Strip that and the residue overlaps `PAIN_POINT`/`INTENT` rather than
  partitioning against them — "does anyone else find X slow?" is a pain point phrased as a question.

**The "reserved — no producer" marking is a fig leaf.** It lives in a markdown cell; the contract
carries no reservation at all, and `z.nativeEnum(SignalType)` (`evidence.schema.ts:18`) will accept
`ENGAGEMENT` from any caller on day one. A reservation the type system and the validator both
contradict is not a mitigation. And there is **no precedent** for the marking — the word appears zero
times in the data dictionary today.

**The asymmetry argument wins cleanly**, and §D2.1 lost it. The usual counterweight — "adding later
forces a coordinated migration across consumers" — is **absent here**: `detect-contradictions.ts:42`
is the entire consumption surface and is an equality test needing no change for any number of new
members. So adding later is unusually cheap and removing a published member is unusually expensive.

⚠️ **A producer that needs to record something the enum lacks already has an unconstrained field** —
`ExtractedSignal.type` is plain `string` (`extracted-signal.ts:5`). The mislabelling risk D2 was built
to prevent has an existing escape hatch, and an enum member does not prevent mislabelling anyway: a
**classification rule** does, and shipping `QUESTION` with no producer ships no rule about when to
choose it over `INTENT`. The first implementer still guesses, now with 12 options instead of 10.

**What the council could NOT refute**, recorded because a lens that only objects is as useless as one
that only agrees:

- `{G2, CAPTERRA, TRUSTPILOT}` is a **real cluster** — it co-varies on every axis tried. One real
  cluster does not license a four-way partition built to accommodate it.
- The change is **cheap and non-breaking**. Nothing is persisted — neither enum appears in
  `schema.prisma` or any snapshot codec — so this is not a forward-compatibility event, and there is
  no exhaustive consumer of either enum to break. That is an argument for **reversibility, not
  correctness**; a published contract's real cost is citation, not code.
- The **origin-not-trust constraint is a genuine prior**, agreed with the Product Owner before the
  review. The objection is that D1's four names do not honour it — not that it was insincere.
- The exhaustive-`Record` mechanism **does** work as claimed, and is robust to this repo's tsconfig
  (prior art: `derive-opportunities.ts:12`, over a string-literal union rather than a TS `enum`).
  ⚠️ But only in one form: written `as Record<…>`, as `Partial<Record<…>>`, or built via
  `reduce`/`Object.fromEntries`, the exhaustiveness guarantee **silently evaporates** and nothing in
  the lint config forbids it. If any classification is ever built, that constraint is binding.

**Recommendation to the Product Owner — reject D1 and D2, keep D3–D7.** The council was scoped to
D1/D2 only and said nothing about the rest, which are boundaries and deferrals rather than contracts.
If a classification is wanted later, the council's finding is that it does not belong on the source
enum at all: it belongs as a field on the `Evidence` record, set by the adapter that fetched the item
— the only thing that knows whether a given YouTube URL is a brand channel or a creator's review.
**That cannot be decided before an adapter exists**, and no adapter is authorized (D7).

---

## 1. Context — what is actually there

Read on 2026-08-02:

- **`EvidenceSource`** (`packages/evidence-contracts/src/enums.ts`) is a flat list of **12 members**:
  `REDDIT · G2 · CAPTERRA · TRUSTPILOT · YOUTUBE · GOOGLE_SEARCH · COMPETITOR_SITE · ADS · SOCIAL ·
JOB_POSTING · GITHUB · FORUM`. Mirrored at `docs/product/05_DATA_DICTIONARY.md:154`.
- **`SignalType`** is a flat list of **10 members** (`PAIN_POINT` … `TECH_STACK_SIGNAL`), mirrored at
  `05_DATA_DICTIONARY.md:155`.
- **RIE does not own either.** `packages/research-intelligence-engine/src/types/enums.ts`
  **re-exports** both from `@age/evidence-contracts` per ADR-0010, with a comment saying so. A change
  made in RIE would not be the contract; it would be a fork.
- **Nothing reads `EvidenceSource` to make a decision.** `scoreEvidenceQuality` weights only
  `confidence` (0.55), mean `extractedSignals[].strength` (0.35) and `rawContent` length against a
  240-character cap (0.10). The source field is carried and displayed; it is never consulted.

So the 12 members are, today, a **label** — and the flat list quietly implies that a first-party
G2 review and an anonymous forum post are the same kind of thing. They are not, and the difference
matters the moment anything weights them.

---

## 2. Decisions

### D1 — `EvidenceSourceClass` is added; `EvidenceSource` is RETAINED, never replaced

A second, small enum classifies each existing source by **what kind of act produced it**, not by how
trustworthy it is:

| Class               | Members                                 | What it means                                                           |
| ------------------- | --------------------------------------- | ----------------------------------------------------------------------- |
| `SOLICITED_REVIEW`  | `G2`, `CAPTERRA`, `TRUSTPILOT`          | A review surface where the vendor invited the review                    |
| `PUBLIC_DISCUSSION` | `REDDIT`, `FORUM`, `SOCIAL`, `YOUTUBE`  | Unprompted third-party discussion                                       |
| `VENDOR_CONTROLLED` | `COMPETITOR_SITE`, `ADS`, `JOB_POSTING` | Published by the subject; states intent, not experience                 |
| `INDEXED_ARTIFACT`  | `GOOGLE_SEARCH`, `GITHUB`               | A retrieval surface or a work product, not a statement about a business |

🚫 **`EvidenceSource` is NOT removed, NOT deprecated, and NOT collapsed into the class.** The specific
source is what a human needs to audit a claim; the class is what code may reason about. Removing the
specific value to "simplify" destroys the audit trail and is forbidden without a new ADR.

The mapping is an **exhaustive `Record<EvidenceSource, EvidenceSourceClass>`**, so adding a 13th
source fails `tsc` until someone classifies it. A `Map` with a default, or a `switch` with a
fallthrough, reintroduces the silent-default failure this shape exists to prevent.

### D2 — `QUESTION` and `ENGAGEMENT` join `SignalType`

- **`QUESTION`** — the subject's market is asking something the subject has not answered. Distinct
  from `PAIN_POINT` (a stated problem) and from `INTENT` (a stated purchase direction): a question is
  neither a complaint nor a buying signal, and mapping it to either misreports it.
- **`ENGAGEMENT`** — a measured interaction (reply volume, thread depth, reaction count) rather than
  an expressed opinion. It is the only member that is **not** a statement, which is precisely why it
  needs its own member instead of being smuggled in as `strength` on another type.

⚠️ **See §0.1c.** Neither has a producer today and D7 forbids building one.

#### D2.1 — Why define them now rather than with the first producer

🛑 **SUPERSEDED BY §0.1e. Its conclusion was WRONG, and in the specific direction it was most
confident about.** This section argued `ENGAGEMENT` survives on structural grounds while `QUESTION`
does not. The council found the structural argument runs the **opposite** way, and the code agrees:
`ENGAGEMENT` is a measurement rather than a speech act, must invent a required `polarity`, and would
manufacture false contradictions at `detect-contradictions.ts:42`. It is left standing undeleted
because a confident wrong answer is worth seeing next to what corrected it — and because it is the
clearest evidence in this repo for why §0.1d's council was made a precondition rather than a courtesy.

The Product Owner asked for this argument explicitly. It is given, and then its strongest
counter-argument is given too, because the honest answer is that **the case is good for one member
and weak for the other.**

**The argument for defining early.** The cost of an enum member is not symmetric across time.

1. **Absence does not stop the data; it misroutes it.** With no `QUESTION` member, the first
   implementer who meets a market question still has to store it, and will map it to `PAIN_POINT` or
   `INTENT` because those are the nearest members that exist. The enum then reads as though a
   population of complaints or buying signals was observed. Adding `QUESTION` afterwards does not
   fix that — the rows are already mislabelled, and correcting them is a backfill over data whose
   original meaning is no longer recoverable. **The expensive artefact is the misclassified row, not
   the enum edit.**
2. **Now is the cheapest moment there will ever be.** There are zero producers _and_ effectively zero
   consumers. Every exhaustive mapping added later (D1's `Record` is the first) must cover every
   member; adding a member after consumers exist means each non-exhaustive `switch` silently routes
   it to its default, which is the failure mode D1 exists to prevent. Today the compiler catches all
   of it and nothing in production can break.
3. **AGE's own precedent is that vocabulary invented under delivery pressure goes wrong.** RankOps
   ADR-0033 is the worked example: two sides of one boundary independently chose a scale — `0–1` on
   the guard, `0–100` in the worker and the column — and a single real result would have denied every
   page permanently. Nobody decided that; it was decided by whoever typed first. A contract amended
   ahead of its producer is a contract nobody has to guess at.

**The counter-argument, which the architect finds genuinely strong.** Enum changes are asymmetric in
the other direction too: **adding a member later is easy, removing a published one is not.** If the
first real producer turns out to be a review surface rather than a community one, `QUESTION` and
`ENGAGEMENT` may be the wrong shapes entirely — and the data dictionary will by then have published
them, giving them the authority of a decided contract while no evidence has ever tested whether they
carve reality at a joint. Speculative vocabulary is harder to retract than to add.

**Where that leaves each member — they are not equally justified.**

- **`ENGAGEMENT` survives the counter-argument.** Its justification is _structural, not empirical_: it
  is the only proposed member that is a **measurement rather than a statement**. That is true of the
  contract's shape regardless of which producer arrives first, and the alternative — smuggling a
  reply count in as `strength` on an opinion-typed signal — is a category error that no later
  producer would make it not be.
- **`QUESTION` does not fully survive it.** Its justification is empirical: it claims market questions
  are common enough and distinct enough to need their own member. **That claim is untested, and this
  ADR cannot test it** — no producer means no sample. Argument 1 above is the real case for it, and
  argument 1 is a prediction about an implementer who does not exist yet.

**Consequently, both members are marked `reserved — no producer` in the data dictionary (D6), and
that marking is part of the decision, not a footnote.** A published member that nothing can emit
must not be readable as a capability AGE has. If the council in §0.1d cannot defend `QUESTION` on
better grounds than argument 1, **the correct outcome is to ship `ENGAGEMENT` alone and park
`QUESTION`** — that split is a legitimate amendment of this ADR, not a rejection of it.

### D3 — Discovery-evidence and performance-feedback are separated, and never scored on one scale

Evidence answering _"what is true about this market?"_ (discovery) and evidence answering _"did the
thing we shipped work?"_ (performance feedback) are different in kind. Discovery evidence is about a
world AGE did not act on; performance feedback is about AGE's own output.

They must not share a quality score, be averaged, or be ranked against one another — the same rule
the demo already states for readiness states: _"These readiness states are NOT comparable with one
another."_ A single "evidence quality" number spanning both would be a scale in which no shared unit
exists.

🚫 **This decision does NOT add a performance-feedback type, table or producer.** It fixes the
boundary **before** one is built, so the first implementer inherits the rule instead of inventing it.

### D4 — Time-series and momentum are DEFERRED, explicitly

AGE cannot honestly report that a signal is _growing_. ADR-0044 D5's `listSeries` is unpaginated, D6
forbids reporting that a change _happened_ rather than that the series _records_ one, and ADR-0055 §5
item 1 already parks cross-snapshot reading behind its own ADR.

**Momentum is therefore out of scope by decision, not by omission.** No `trend`, `velocity`,
`momentum` or `deltaSinceLastCapture` field may be added to the evidence contract under this ADR. A
field that can only ever be `null` is worse than an absent one: under ADR-0026 D4 it invites reading
absence as a finding.

### D5 — Falsification: the demo baseline must not move

This ADR is contract-and-docs only, so it must be provable that **nothing computed changes**. The
falsification test is `apps/demo` — if any of these move, this ADR was implemented wrongly:

| Baseline                         | Value              | Pinned at                                                                     |
| -------------------------------- | ------------------ | ----------------------------------------------------------------------------- |
| intake completeness / confidence | **98 / 63**        | `packages/demo-runtime/src/tests/business-discovery.spec.ts:109`              |
| BIF completeness / confidence    | **12 / 17**        | same suite                                                                    |
| intake `readinessBand`           | **`strong`**       | ≥90 threshold, `business-discovery-contracts/src/completeness-scoring.ts:110` |
| populated / omitted sections     | **7 / 5**          | `apps/demo/sample-output.txt`                                                 |
| `sample-output.txt`              | **byte-identical** | `apps/demo/src/tests/run.spec.ts`                                             |

⚠️ **Byte-identical is the whole point.** Adding a class to the contract must not change one
character of what the demo prints. If the output moves, the class is being _read_ by something, which
is D7's line — not a cosmetic diff to re-baseline. 🚫 **Do not update `sample-output.txt` to make a
test pass under this ADR.**

### D6 — Bible amendment scope: one file, two lines

Amend **`docs/product/05_DATA_DICTIONARY.md` only**:

- **line 154** — add an `EvidenceSourceClass` row beneath `EvidenceSource`, leaving the existing row
  unchanged (D1 retains it).
- **line 155** — extend the `SignalType` row with `QUESTION` and `ENGAGEMENT`, each marked
  **`reserved — no producer`**. ⚠️ **That marking is load-bearing, not decoration** (D2.1): the data
  dictionary is read as a statement of what AGE can do, and an unmarked member is indistinguishable
  from one something actually emits. 🚫 The marking is removed by the PR that lands the first
  producer, and by no earlier PR.

`11_INTEGRATION_CATALOG.md` is **NOT** amended: it does not reference these enums (§0.1b). No other
Bible document changes.

Per the **#209/#211 precedent**, the amendment lands only after a Product Owner comment on the open
PR. The architect does not merge their own reading of the Bible.

### D7 — Out of scope, and this ADR must not be implemented before it is accepted

🚫 **None of the following is authorized here, and none may be started as "obviously implied":** no
source adapter or connector of any kind; no credential, key or token for any external surface; no
`mcp-social-server`; no ingest endpoint or callback route; no API or Web surface; no change to
`scoreEvidenceQuality`'s formula — **D1 deliberately declines §0.1a's offer of a reliability
ranking**, because classifying a source is not the same as deciding one is worth more, and the second
is a business judgment this ADR does not make either.

🚫 **No real client record, answer file or captured context is committed** — not redacted, not masked
(ADR-0053 D3). Obvious fictionality is the guard; repo visibility is not a control.

---

## 3. What this ADR does NOT claim

1. ⚠️ **It does not claim AGE can read any new source.** It adds vocabulary, not reach. After this
   ADR, AGE senses exactly what it sensed before: nothing.
2. ⚠️ **It does not claim the classification is a trust ranking.** D1 is about the _kind of act_ that
   produced a record. Whether `SOLICITED_REVIEW` outranks `PUBLIC_DISCUSSION` is undecided, and D7
   keeps it that way.
3. ⚠️ **It does not resolve §0.1c.** Two enum members ship without producers, over a live objection.
4. ⚠️ **It was written without a council** (§0.1b). §0.1d makes one a **precondition of acceptance**
   on D1 and D2, so as it stands this ADR is not ready to be accepted — including by a Product Owner
   who is persuaded by it.
5. ⚠️ **It does not claim `QUESTION` is justified.** §D2.1 concludes only `ENGAGEMENT` survives its
   own counter-argument on present evidence. Shipping `ENGAGEMENT` alone is an anticipated amendment.

---

## 4. Consequences

**If accepted:** the standing request in `score-evidence-quality.ts` is discharged — answered, not
implemented — and the first adapter author inherits a vocabulary and a boundary (D3) instead of
inventing both under delivery pressure. The comment in that file should be updated to point here.

**If rejected:** `EvidenceSource` stays a flat label, and the next implementer who needs to weight
sources faces the identical parked decision with no more information than the last one had. That is a
tolerable outcome; the file's comment should then be amended to say the decision was _considered and
declined_, so a third session does not re-open it as an oversight.

---

## 5. Recorded, NOT authorized

⚠️ **This section is not a to-do list.** Each item needs a fresh `Status: Proposed` ADR, read in its
own words. **Next number after this one is 0057.**

1. A reliability ranking across source classes, and any change to `scoreEvidenceQuality` (§0.1a
   offered it; D1 declined it).
2. The first evidence producer — any adapter, any credential, any ingest surface (D7).
3. A performance-feedback type and its producer (D3 draws the boundary; it authorizes nothing).
4. Momentum, trend and cross-snapshot reading (D4; see also ADR-0055 §5 item 1).
5. Any `mcp-social-server`, mcp-ads or RankOps integration.
