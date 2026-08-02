# ADR-0056 — What counts as evidence

Status: Proposed
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

⚠️ **No council was convened for this ADR.** The operating mode calls for one on high-blast-radius
decisions, and an enum in the published data dictionary qualifies. This ADR is docs-only and
self-blocking (D7 forbids implementation before acceptance), so the cost of proceeding without one is
bounded — but it is a **departure, recorded here rather than concealed**, and the Product Owner
should weigh the decisions below knowing they carry one perspective, not four.

### 0.1c The dissent the architect could not resolve

**D2 adds two enum members whose producers do not exist.** `QUESTION` and `ENGAGEMENT` describe
signals that arrive from social and community surfaces AGE cannot currently read — there is no
adapter, no ingest endpoint, and D7 forbids building one. A reasonable objection is that an enum
member no producer can emit is the same defect ADR-0055 is named after: a row nobody writes.

The counter-argument, which the architect finds narrowly stronger but not decisively so: the enum is
a **published contract in the data dictionary**, and contracts are amended before producers, not
after — the alternative is that the first adapter's author invents the vocabulary under delivery
pressure, which is exactly how the units bug in RankOps ADR-0033 happened. **Recorded unresolved.**

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
- **line 155** — extend the `SignalType` row with `QUESTION` and `ENGAGEMENT`.

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
4. ⚠️ **It was written without a council** (§0.1b), against the operating mode's own §3.

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
