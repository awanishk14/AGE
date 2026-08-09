# ADR-0065 — A live client's name is client data, in prose as much as in a fixture

- **Status:** Accepted
- **Date:** 2026-08-09
- **Supersedes:** nothing
- **Superseded by:** nothing
- **Related:** **ADR-0053 D3 (which this ADR enforces rather than extends)**, ADR-0053 §0.2b (the
  redaction this ADR governs), ADR-0054 D2/D3 (operator files live outside the repository)

---

## 0. How this decision was reached

### 0.1 Acceptance is the architect's, under a standing grant

This ADR is **self-accepted** under the standing mandate recorded in the operator's working memory,
quoted verbatim:

> _"i told you to act as an architect and take descision that makes the software robust and perform
> for whats it intended. incase of complex issue deploy council to make decision. and also keep
> creating session handover document at important checkpoint so we dont loose track and you
> continusoy work without stopping for asking me question."_

⚠️ **The redaction itself was NOT self-authorized.** It was flagged to the Product Owner on
2026-08-08 as a governance decision, and they instructed it directly: _"if it should be removed,
remove it, and then move to ADR 65"_. This ADR records the reasoning and generalises the rule.

⚠️ **Why self-acceptance is proper here specifically.** This ADR **tightens** an existing
owner-accepted refusal and widens nothing. 🚫 It creates no surface, authorizes no code path, grants
no permission, and reverses no decision. ADR-0064 was deliberately left `Proposed` on exactly this
distinction: that one asks to _narrow_ a refusal, and so is the owner's.

### 0.2 What went wrong, stated plainly

**ADR-0053 D3 says real client records are never committed — _"not even a redacted or
partially-masked one"_.** The guard shipped for it (#259) holds the two live names as SHA-256
digests and scans for them.

⚠️ **It scanned only the committed fixtures inside `@age/client-registry`.** Meanwhile ADR-0053's
own prose spelled both names in two places, from the day it was written. **The document stating the
rule was the document breaking it, for seven days, in a repository that was public for part of
that window.**

🚫 **The failure was not the missing scan.** It was the assumption that "a client record" meant a
record-shaped object. A name in a sentence identifies the client exactly as well as a name in a
`displayName` field — better, because prose is what search engines and code-search index.

---

## 1. Context

- **The repository's visibility is not a control.** It flipped to private and back on 2026-08-02
  without anyone noticing, and 🚫 history stays committed either way. ⚠️ **ADR-0053's §1 still says
  _"`awanishk14/AGE` is a public repository"_** — that sentence is now a factual erratum, left in
  place because it states the more cautious premise and correcting an Accepted ADR's reasoning is a
  larger act than this ADR needs.
- **The names are low-entropy.** The digest list removes them from the readable surface; 🚫 it is
  **not** secrecy. Anyone holding a candidate name can confirm a match by hashing it, exactly as
  the guard does.
- **Two other untracked files carry the names legitimately** — the operator's working memory and
  standing context. ⚠️ They are untracked **by rule** and 🚫 must never be committed. A guard that
  walked the working tree would fail on them locally and pass in CI, which is the worst of both.

---

## 2. Decisions

### D1 — A live client's name is client data wherever it appears, prose included

⚠️ **ADR-0053 D3 covers names in ADRs, comments, commit messages, test names, fixtures, sample
output, documentation and PR bodies.** This is a clarification of D3's scope, 🚫 not a new rule and
🚫 not a widening of it.

🚫 **A name is not exempt because it is "just context", "just an example", or "already public
knowledge about the client".** What the repository asserts is not that the business exists — it is
that **this operator has that business as a client**, which is the operator's commercial
information and is nobody's to publish.

### D2 — The guard scans every file git tracks, not a curated subset

The scan walks `git ls-files` from the repository root and examines every tracked text file.

⚠️ **`git ls-files` is the correct oracle and a directory walk is not**, for a reason that is the
whole point: the rule is _"never **committed**"_. Asking git what is committed answers the actual
question, and it automatically excludes the two untracked files that legitimately hold the names —
so the guard behaves identically on the operator's machine and in CI.

⚠️ **The guard states its own exclusions.** Binary files and lockfiles are skipped, and the test
asserts the number of files examined so 🚫 an empty or failed walk can never report compliance.
⚠️ It also asserts that `docs/adrs/` was among the files examined — the directory that actually
leaked must be provably in scope, not merely presumed to be.

🚫 **The failure message names the file and never the match.** Returning the matched text would put
a live client's name into a CI log, and 🚫 CI logs are public. This is why
`containsForbiddenClientName` returns a boolean.

### D3 — 🛑 HISTORY IS NOT REWRITTEN, AND THE LIMIT IS STATED RATHER THAN PAPERED OVER

🚫 **No `filter-branch`, no `filter-repo`, no force-push, no squash designed to drop the names.**

⚠️ The names are in every commit between ADR-0053's and the redaction. A history rewrite would
break every existing clone, every open PR's merge base and every fork, **to remove data that those
same clones and forks already hold**. It would buy the _appearance_ of erasure. 🚫 AGE does not ship
appearances of properties it does not have — that is the same rule as `not-assessed` never
rendering as `ready`.

✅ **Redacting forward is still worth doing on its own terms:** it stops the leak growing, removes
the names from the surface anyone actually reads, and makes the guard's claim true going forward.
⚠️ **It is 🚫 never described as "the names have been removed from the repository."** The honest
sentence is that they are removed from the current tree and remain in history.

⚠️ **If the Product Owner ever decides the history must go, that is their decision and needs its own
ADR** — and it should be paired with the only thing that actually helps, which is treating the
association as disclosed and acting accordingly.

### D4 — Adding a client means adding a digest, in the same change

⚠️ When the operator takes on a live client whose records enter the local registry, its digest is
added to `FORBIDDEN_CLIENT_NAME_DIGESTS` **in the same change**. 🚫 Do not add a comment naming
which entry belongs to which client — the digest exists precisely so the file does not carry the
name.

🚫 **`forbiddenNameDigestOf` must never be called with a real name in committed code.** Run it once
locally, paste the two values.

---

## 3. What this ADR does NOT claim

- 🚫 It does not claim the names are secret now. They are in history and possibly in indexes.
- 🚫 It does not claim the guard is complete. It catches the two known names in any spelling that
  normalises to the same thing; it knows nothing of a name nobody registered, and 🚫 it cannot
  detect an identifying description that avoids the name entirely.
- 🚫 It does not authorize any code path, surface, screen or permission, and it does not touch
  ADR-0064, which remains `Proposed` and the Product Owner's.
- 🚫 It does not make the repository safe to make public. That is a separate decision on separate
  evidence.

---

## 4. Consequences

- One redaction (ADR-0053 §0.2b), one guard that scans every tracked file, and a rule whose scope
  now matches what it was always meant to cover.
- ⚠️ **The guard will fail loudly the next time a name is written into any tracked file**, including
  in an ADR explaining why names must not be written into ADRs. That is correct: #259 already
  proved that an explanation of the rule is 🚫 not an exemption from it.
- ⚠️ **Expect it to be briefly annoying and do not weaken it for that.** A guard relaxed to let one
  "obviously fine" mention through is a guard that no longer holds.

---

## 5. Recorded, NOT authorized

⚠️ **Not a to-do list.** Each needs a fresh `Status: Proposed` ADR. **Next number after this one is 0066.**

1. Rewriting git history to remove the names (D3) — 🛑 the Product Owner's decision, not the
   architect's, and it does not achieve what it appears to.
2. Correcting ADR-0053 §1's stale _"is a public repository"_ premise, and any other factual erratum
   inside an `Accepted` ADR's reasoning.
3. Scanning for identifying descriptions, ad-account identifiers or property ids in prose. ⚠️ The
   fixture guard already checks ids in fixtures; extending that to prose is a different problem
   with a much worse false-positive profile.
4. Any statement about whether this repository may be public.
