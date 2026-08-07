# ADR-0059 — Assisted intake, and the answer nobody gave

Status: **D6 Accepted** (2026-08-07, by the Product Owner — see §0.1b) · **D1–D5 and D7 remain
`Proposed`** — 🛑 still a decision request, and 🚫 still not self-acceptable.
Date: 2026-08-07
Relates to: ADR-0049 **D2** (no default parameter — the pipeline must stay falsifiable), ADR-0050
**D2** (the mapper **TRANSCRIBES and never INFERS**), ADR-0051 (the enum is on the **question**,
never on the answer), ADR-0053 **D3** (real client records are never committed) and **D4** (the
operator principal is never defaulted, generated or inferred), ADR-0054 **D2/D3** (an operator
file's path is never defaulted; an unknown client is refused) and **D7** (a low score for a real
client is a **correct result**), ADR-0056 (what counts as evidence), ADR-0057 **D2** (OX-INV-1 —
loopback or refuse) and **D4** (the three action classes), ADR-0058 (identity — 🛑 **`Proposed`,
unaccepted, so the console has no authentication at all**).
Product documents: `18_AGE_STUDIO.md` §7.1, `docs/product/studio/ST_02`, `ST_05`.

---

## 0. How this decision was reached

### 0.1 Standing

Written under the standing architect grant (ADR-0043 §0.1, reaffirmed 2026-07-30), in direct
response to the Product Owner's message of 2026-08-07, after they completed Business and Discovery
in the console for the first time:

> _"but the entire process was too boring and no feels filling it. it should ideally be autofilled
> but all information that gets feeded to system either in doc, pdf or may be website url if
> provided or a widget gets added to website. i dont know but the process should be simplfied"_

🚫 **It is NOT self-accepted, and the grant does not stretch to cover it.** The grant is over
decisions the architect can reason to. Four things here are not, and each one is a `CLAUDE.md` §3
hard boundary by name:

1. **URL fetching** — "no URL fetching". A website URL cannot be read without it.
2. **External APIs** — "no external APIs". A widget on a customer's website is an inbound one.
3. **AI/LLM calls** — "no AI/LLM calls". Turning a PDF into structured discovery answers is the
   canonical use, and it is refused today.
4. **An epistemic change, which is the real one.** ADR-0050 D2 says the mapper **transcribes and
   never infers**. An answer AGE lifted out of a brochure is _not_ an answer the operator gave. If
   both land in the same field with the same weight, every downstream score — completeness,
   confidence, evidence, readiness — silently begins to measure **what a document claimed** while
   still being labelled **what the business said**. That is not a feature flag. It is a change to
   what an AGE number means.

⚠️ This ADR is the _shape_ of assisted intake. It authorizes **no code** on acceptance except what
**D8** names exhaustively.

### 0.1b Acceptance — D6 only, in the Product Owner's own words (2026-08-07)

> _"And ADR-0059 is still waiting on you; D6 is the part that would make filling this in less
> painful next time., go ahead then iplement it"_

That is an acceptance of **D6 and nothing else**. Read against **D8**, it authorizes exactly: _"the
five items in D6, in `apps/studio`, with no change to the answer file's meaning."_

🚫 **It is NOT an acceptance of D1, D2, D3, D4, D5 or D7**, all of which stay `Proposed`. In
particular it authorizes **no** source reading of any kind — no local file, no PDF, no URL, no
widget — **no** model call, and **no** change to any score's definition. A later session must not
read this acceptance as momentum for the rest of the ADR; §0.2 exists precisely because that is the
failure mode this split was designed to prevent.

⚠️ **Not self-accepted.** The Product Owner accepted in their own words, quoted above, and this
`Status` flip is a separate PR from the ADR's own (the §7 convention: #88→#89, #93→#94, …).

### 0.1c Erratum — D6 item 4 was wrong about autosave, and is corrected below

**D6 item 4 as originally written said "🚫 Not autosave — autosave is class 3 under ADR-0057 D4 and
stays refused." That was an error of fact by the ADR's own author, and it is corrected in D6.**

Autosave of the operator's discovery draft was **put to the Product Owner and permitted on
2026-08-03**, and has shipped since. Their words are recorded in
`apps/studio/src/components/discovery-form.tsx`:

> _"This is not AGE making a business decision; it's simply preserving the operator's draft."_

The reasoning holds and is already written into `canSubmit`'s contract in
`packages/studio-shell/src/discovery-draft.ts`: preserving keystrokes the operator already typed
initiates nothing and decides nothing, so it is not class 3. What **is** class 3, and remains
refused, is anything that would **submit** on the operator's behalf — no timer, no on-blur, no
submit-when-complete.

🚫 **Do not remove working autosave on the strength of the erratum.** An ADR written after a
decision does not repeal it, and this one did not intend to: item 4's subject was always _save and
resume_, which autosave already delivers.

### 0.2 The complaint is correct, and it is two complaints

The Product Owner's message contains two problems that are usually treated as one, and they have
very different costs:

- **"Too boring · no feels filling it"** — an _experience_ problem. The intake is a long flat list
  of questions with no sense of progress, no grouping, no explanation of why any question is being
  asked, and no way to stop and come back. **None of this needs extraction to fix, and none of it
  crosses §3** (see **D6**).
- **"It should ideally be autofilled"** — a _sourcing_ problem. It needs AGE to read something the
  operator did not type. **Every route to it crosses a boundary**, and they cost different amounts
  (see **D4**).

🚫 **They must not be shipped as one thing.** Bundling them means the cheap, wholly-authorized fix
to the actual felt pain waits behind the expensive decision — and, worse, that the expensive
decision gets accepted under the momentum of the cheap one.

### 0.3 What this ADR deliberately does not do

It does not choose an extraction vendor, does not specify a file format, and does not design a
widget protocol. Those are implementation questions that only become askable once **D1**, **D2** and
**D4** are decided.

---

## 1. Context

An AGE discovery answer is currently unambiguous: a human sat down and stated it. Every guarantee
built on top of that — `discoveryCompletenessScore` as _intake capture completeness_,
`discoveryConfidenceScore` as a property of the interview, ADR-0056's account of what counts as
evidence — inherits its meaning from that one fact.

Autofill breaks the fact, not the format. The question this ADR exists to answer is: **can AGE
accept an answer nobody gave, and still be the kind of system whose numbers mean something?**

The answer proposed here is **yes, but only if the answer is never AGE's**.

---

## 2. Decisions

### D1 — Assisted intake proposes; it never answers

An extraction source produces **candidate answers**, and a candidate is **not an answer**. Nothing
enters the discovery answer file until a human has seen the candidate, seen **where it came from**,
and accepted it.

🚫 **No bulk "accept all".** 🚫 No "accept everything above confidence X" — a threshold is an
inference about inferences, and it is exactly the move ADR-0050 D2 refuses one level up.
🚫 A candidate that is never reviewed is **discarded**, never quietly promoted at submit time.

**Why not just autofill the fields and let the operator edit?** Because a prefilled field that is
plausible is a field nobody reads. The tedium being complained about is the same force that would
make "review" a formality. The acceptance must be a positive act per answer, or the review is
theatre — and theatre is worse than the boring form, because the boring form was honest.

### D2 — Every answer carries how it was obtained, and it is never defaulted

A discovery answer gains a required provenance, with **no default value** (ADR-0049 D2 — a default
makes the distinction unfalsifiable behind a field that only _looks_ recorded):

- `stated` — a human typed it.
- `confirmed-from-source` — proposed by an extraction source and **accepted by a human**, carrying
  the identity of the source and the location within it.
- 🚫 There is **no third value meaning "extracted".** An unconfirmed extraction is not an answer and
  therefore has nothing to carry a provenance on (**D1**).

⚠️ Existing answers are `stated`. That is a true statement about them, not a migration default.

### D3 — Extraction confidence never becomes discovery confidence

`discoveryConfidenceScore` is a property of the interview (`CLAUDE.md` §5). An extractor's own
certainty is a property of a _parser_. 🚫 They must never be combined, averaged, or substituted, and
🚫 an extractor's confidence must never be written into an answer field, because from there it is one
refactor away from being scored.

⚠️ Corollary: a business whose file was assembled largely from documents should not score **higher**
in confidence than one interviewed in person. If it does, the score has stopped measuring the
interview. **ADR-0054 D7 governs — a low score is a correct result, and 🚫 the response to a low
score is never to touch the mechanism that produced it.**

### D4 — The four routes are not one feature, and they do not cost the same

Ranked by what each one asks AGE to give up. 🚫 **Acceptance of a lower-numbered route is not
acceptance of a higher one.**

| #   | Route                                                                                                                      | What it crosses                                                                                                                                                                                       | Verdict proposed                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | **A file the operator already has** (`.txt`, `.md`, `.csv`), read from an absolute path outside the repo under ADR-0054 D2 | **Nothing.** No network, no vendor, no model. Local parse of text the operator chose.                                                                                                                 | **Allowed** under D1+D2                                       |
| 2   | **PDF / DOCX** — the same, but needing a decoder                                                                           | A **dependency**, not a boundary. The bytes never leave the machine.                                                                                                                                  | **Allowed**, subject to naming the library in a follow-up ADR |
| 3   | **A website URL**                                                                                                          | 🚫 **URL fetching** — §3 by name. Egress from a console whose entire safety argument (OX-INV-1) is that it talks to nothing.                                                                          | 🛑 **Refused pending its own decision**                       |
| 4   | **A widget on the client's website**                                                                                       | 🚫 **External APIs** — an _inbound, public, unauthenticated_ endpoint, in a product where **ADR-0058 is unaccepted and there is no authentication at all**. It is also **class 3** under ADR-0057 D4. | 🛑 **Refused. Not "later" — refused.**                        |

⚠️ **Route 4 is the one to be most careful about**, because it sounds like the smallest. A widget is
a public write path into a client's business facts, reachable by anyone who views the page,
terminating in a console that binds loopback precisely so that nothing outside can reach it. It
inverts OX-INV-1 rather than bending it. 🚫 **A "read-only" or "collect-only" widget is the same
endpoint.**

⚠️ Route 3 is refused _pending a decision_, not permanently — but note what it actually costs:
fetching a URL means AGE's own network identity requests an arbitrary address chosen from operator
input. That is a server-side request forgery surface in a process that reads the operator's local
filesystem. It needs its own ADR with its own allow-list decision, not a checkbox in this one.

### D5 — Model-based extraction is a separate decision, and it is about data, not capability

🚫 **No LLM call is authorized by this ADR.** Beyond §3's plain refusal, the decisive fact is not
technical: turning a real client's documents into structured answers means **transmitting a real
client's business documents to a third party**. ADR-0053 D3 refuses to let a real client's records
into a _commit_; a vendor request is a wider disclosure than a commit, not a narrower one.

If it is ever proposed, the ADR must name the vendor, the data-handling terms, what is redacted, and
who at the client consented. 🚫 "It is only used for parsing" is not a data-handling term.

⚠️ Routes 1 and 2 need **no model at all** — a source document plus a human choosing which sentence
answers which question is the whole mechanism, and it removes most of the typing.

### D6 — The boring form can be fixed today, and that is the real answer to the complaint

Wholly within **class 2** (Knowledge Authoring, ADR-0057 D4) and crossing nothing:

1. **Grouping and progress** — questions in named sections with an honest "answered N of M in this
   section". ⚠️ Honest: a progress bar must count **questions**, never imply _readiness_.
2. **"Why this is asked"** — each question carries what it feeds. The intake is boring partly
   because it reads as a form rather than as an interview with a purpose.
3. **Explicit skip** — "not applicable" and "don't know yet" as _recorded_ answers distinct from
   _unanswered_. ⚠️ This is honesty, not convenience: today those three states collapse into blank.
4. **Save and resume** — the operator can stop and come back without losing what they typed.
   ⚠️ **CORRECTED — see §0.1c.** This item originally said autosave was class 3 and refused. That
   was wrong: the Product Owner permitted draft autosave on 2026-08-03 and it has shipped since.
   🚫 Do not remove it. What stays refused is anything that would **submit** on the operator's
   behalf — no timer, no on-blur, no submit-when-complete.
5. **Prefill only what a record already states** — the business's display name and organization come
   from the resolved `ClientRecord`. 🚫 Nothing else. 🚫 Never a guess from the name of the business.

⚠️ **D6 is the part that answers "too boring" and it needs none of D1–D5.** If only one thing is
accepted from this ADR, it should be this.

### D7 — An empty extraction is not "no information"

The failure this whole track invites: a source is read, nothing matches, and the screen renders as
though the business has no offerings. **Sources read** and **facts found** are different counts, and
🚫 neither may be rendered as an assessment. A document AGE could not parse must say **so**, by name,
and 🚫 must never reduce to a zero. This is the same refusal `contradictions` already ships (#240).

### D8 — Exhaustively, what acceptance authorizes

On acceptance of **D6 only**: the five items in D6, in `apps/studio`, with no change to the answer
file's meaning.

On acceptance of **D1–D2, D4 routes 1–2, D6, D7**: additionally, a local source-reading surface that
produces candidates and writes **only** human-accepted answers, with provenance.

🚫 **Nothing else.** In particular, acceptance authorizes **no** URL fetch (D4.3), **no** widget
(D4.4), **no** model call (D5), **no** vendor integration, and **no** change to any score's
definition. ⚠️ This list originally also said "no autosave" — struck, per the §0.1c erratum:
autosave was already permitted on 2026-08-03 and this ADR never had standing to repeal it.

---

## 3. Dissent

Recorded so the Product Owner sees the disagreement rather than a consensus that did not exist.

1. **"D1 defeats the purpose."** If every extracted answer must be individually accepted, the
   operator is still reading and clicking through every question, and the tedium is barely reduced.
   The counter-position is that reviewing a proposed sentence is materially faster than composing
   one from nothing — but this is an **assumption, and it is the load-bearing one**. If it is false,
   D1 should be revisited rather than quietly relaxed into a threshold.
2. **"Route 4 is refused for a reason that will expire."** Once ADR-0058 is accepted and there is
   real authentication, a widget is an ordinary product feature and this ADR will read as
   over-cautious. Accepted — but it is refused _now_, on facts that are true _now_, and the ADR that
   revisits it should be written after ADR-0058, not before.
3. **"D3 will be unpopular."** The Product Owner's likely instinct on seeing a document-assembled
   business score low on confidence is that the score is broken. It is not; ADR-0054 D7 already
   settled the general case. Flagging it here so it is a **known** consequence and not a surprise.

---

## 4. Consequences

- The intake stops being a wall of blank fields — under **D6**, without any new boundary.
- AGE gains a distinction it does not currently have: **who said this**. That is a strengthening of
  the epistemics, not a dilution, provided **D1** and **D2** hold together. If **D1** is relaxed,
  **D2** becomes decoration.
- Four §3 boundaries are named and three of them stay closed. 🚫 This ADR must not be cited as
  precedent for opening any of them.

---

## 5. Recorded, not authorized

Not a to-do list. Each needs its own `Status: Proposed` ADR: a URL source (D4.3), a widget (D4.4), a
model-based extractor (D5), and any change to how provenance participates in scoring.
