# ADR-0051 — Questionnaire enums track checkpoint

> The verbatim record of **ADR-0051 D1–D4**, implemented by **PR #202** (`911289b`, merged
> `ef8862a`). Read this before touching `entryKind`, `PROFILE_SIGNAL_TARGETS`, the duplicate-
> `satisfiedBy` check, or the demo baseline.
>
> Companion records: `ADR0050_ANSWERS_TO_PROFILE_TRACK_CHECKPOINT.md` (the mapper this builds on)
> and `COUNCIL_2026_08_01_TRACK_CHECKPOINT.md` (the council that produced ADR-0051).

---

## 1. What the defect was, and what it was not

ADR-0050 declared `offerings` and `evidenceSources` `untranscribable` because `Offering.type` is a
required `OfferingKind` and `EvidenceSourceRef.kind` a required `EvidenceSourceKind`, and no
free-text answer supplies either. **That refusal was correct and remains correct about the answer.**
Its consequences were invisible until the mapper existed:

1. Every answers-built profile had `evidenceSources: []` → `noEvidenceCap: 35` → confidence
   **hard-capped at 35**, and `CONFIDENCE_BAND_CAPS` therefore always `'partial'`.
2. `offerings` always empty → `products_services` always omitted → market-discovery and revenue
   **structurally** not-ready.

🚫 **This was NOT a scoring bug and was NOT fixed in the scoring layer.** The scores were correct —
the profile really was empty, and ADR-0026 D4 holds (a limitation, never negative evidence). The
defect was upstream: **the questionnaire had no way to ask.**

---

## 2. The four decisions as shipped

**D1/D2 — the enum is declared on the QUESTION, never derived from the ANSWER.**
`BusinessDiscoveryQuestionnaireQuestion` gains `entryKind?: OfferingKind | EvidenceSourceKind`, with
a Zod mirror. `off-list` became `off-products` (`entryKind: 'product'`) and `off-services`
(`'service'`), both `required` + `critical`, both `kind: 'list'`.

- The **author** classifies once, at design time, visibly in data.
- The **operator** transcribes names verbatim, exactly as before.
- The **mapper** still never inspects prose and still never infers.

⚠️ **ADR-0050 D2 is intact, not weakened.** Do not "complete" the mapper by defaulting `type` to
`'service'` or by reading product-vs-service out of wording — product-vs-service is a real business
fact, and a wrong one is a fabricated conclusion about someone's business.

⚠️ **Do NOT collapse the offerings pair back into one question** that asks the operator "products or
services?". It applies a whole-business answer to every entry, and a business selling both has no
honest answer to give. This was rejected in the ADR and again in review.

**D3 — evidence sources, same treatment.** `ev-sources` became `ev-documents` (`'document'`),
`ev-urls` (`'url'`) and `ev-statements` (`'client-statement'`), all optional. This lifts the 35 cap
**by making the evidence real, never by relaxing the cap**.
⚠️ `'url'` is **a plain reference string that is never fetched.** Nothing here authorizes retrieval
(§3 hard boundary: no URL fetching).

**D4 — `PROFILE_SIGNAL_TARGETS` loses `untranscribable` for exactly those two**, via a new
`kindedList` variant carrying `entryKinds` (the allowed enum values). The other **seven**
never-populated fields — `description`, `valueProposition`, `industry`, `companySize`, `geography`,
`note`, `horizon` — stay never-populated, pinned by a test on the exact entry key sets
(`['id','name','type']`, `['id','kind','label']`, `['id','name']`, `['id','statement']`).

⚠️ **The `untranscribable` variant is KEPT with NO members, on purpose.** It is the vocabulary for
the next field whose required data no answer supplies. Deleting it would make the next such refusal
look like an oversight rather than a decision.

**ADR-0051 §3 — the duplicate-`satisfiedBy` check is NARROWED, never removed.** Its key is now
`` `${satisfiedBy}:${entryKind ?? ''}` ``, so two questions may share a signal **only** when each
pins a distinct enum, and the mapper **appends**. A second question pinning the **same** enum still
throws, with ADR-0050's original message preserved verbatim. Three new throws were added:

- a kinded signal with **no** `entryKind` (never guessed);
- an `entryKind` **outside** the target's enum (an `OfferingKind` on an evidence question);
- an `entryKind` on a **non-kinded** signal (it would write nothing).

⚠️ **This is not a softening of ADR-0050 D4.** An unanswered or unmapped **question** is still never
an error. A **questionnaire** that would make the mapper drop or overwrite a value it was given is a
caller defect — reachable because the questionnaire is an arbitrary parameter.

---

## 3. The D7 erratum — the baseline moved 97 → 98, and that is correct

ADR-0051 D7 said the pinned **97/63 vs 12/17** must not move, reasoning that
`SAMPLE_BUSINESS_DISCOVERY_PROFILE` is a literal not built from answers. **True, and irrelevant.**

> **Completeness is a function of the profile AND the questionnaire**
> (`calculateBusinessDiscoveryCompleteness` scores each question satisfied-or-not), and **D1
> mandates changing the questionnaire.** Held literally, D7 is **unsatisfiable alongside a complete
> D3** — the only way to keep 97 would be to ship a deliberately half-built D3 to protect a demo
> constant.

Recorded as an **erratum in ADR-0051 §2 D7** (the ADR-0050 §3 erratum precedent), **not** by
softening a decision or relaxing a cap.

**Mechanism, checked against the code:** `evidence-assumptions` was 1 of 2 satisfied (`ev-sources`
satisfied; `ev-assumptions` has no `satisfiedBy` and is never satisfiable from structured data). With
three kind-pinned questions and a sample profile carrying all three `EvidenceSourceKind`s, it becomes
3 of 4. At section weight **7**, that is **+1 on the total: 97 → 98.** Degraded fixtures move for the
same reason (**87 → 89**, **92 → 93**).

**Verified unchanged — checked, not assumed:**

| Fact                             | Value                                                                  |
| -------------------------------- | ---------------------------------------------------------------------- |
| `discoveryConfidenceScore`       | **63** (unchanged)                                                     |
| `readinessBand`                  | `'strong'` (unchanged)                                                 |
| BIF pair                         | **12 / 17** (unchanged)                                                |
| Canonical sections               | **7 populated + 5 omitted** (unchanged)                                |
| `ZERO_EVIDENCE_COMPLETE_PROFILE` | **93 / 35 / `'partial'`** (unchanged — §1's defect stays demonstrable) |
| `apps/demo/sample-output.txt`    | differs by **exactly one line**                                        |

⚠️ **The corrected baseline is `98/63 vs 12/17`.** The D7 tripwire stands with the new number: a
change that moves confidence, the band, the BIF pair or the 7 + 5 split has still reached something
it should not have.

⚠️ **Making satisfaction kind-aware was REJECTED.** Requiring an offerings answer per `OfferingKind`
was considered: the sample sells **two services and no products**, so a kind-aware predicate would
report a missing required answer **and a critical gap** for "which products do you sell?" against a
business that honestly sells none — a **fabricated gap** and a band demotion.
`PROFILE_SIGNAL_PREDICATES` stay **kind-blind**, which is also exactly what D1 requires ("not in
scoring, not in the readiness assessors").

---

## 4. Mutation proof — the guards were made to fail before being trusted

| Mutation applied                                                                          | Result                                                                                                            |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Derive the kind from the answer's wording (`/^serv/i.test(text) ? 'service' : 'product'`) | **1 failed**, named `takes the enum from the QUESTION and the text from the ANSWER (ADR-0051 D2/D3)`              |
| Widen the duplicate key to `signal:id` — i.e. remove the check                            | **2 failed**, incl. `still rejects a SECOND question pinning the SAME enum (ADR-0051 §3 — narrowed, not removed)` |
| Restored                                                                                  | **324 passed**                                                                                                    |

⚠️ A guard is evidence only once it has been made to fail. Both new ones were.

---

## 5. Gates and scope

Package: 13 files / **324 tests**, `tsc --noEmit` clean. Downstream: `@age/demo-runtime` 40 ·
`@age/demo` 9 · `@age/api` 48. Repo: `pnpm lint`, `typecheck`, `test`, `build` — 32 projects each.
`pnpm demo` regenerated (bounded by the `####` banners, trailing `createdAt` determinism note kept);
`smoke:demo` → 6 capabilities, 6 pending approvals, accounting invariant true, 6 readiness rows with
no aggregate, no side effects. PR CI: **one** check, **15 executed steps**, pass in 5m52s.
`ci-db.yml` correctly did not trigger — no path match, an expected non-trigger, **not** a skipped
gate.

⚠️ A `prettier --write` glob touched 15 files with **no logical change** (line-ending churn only).
Those were reverted before staging, so the PR is exactly the 15 files that changed.

---

## 6. What this does NOT do

⚠️ Stated plainly so §3 is not overclaimed a second time (the ADR-0050 §3 failure):
**`buildProfileFromAnswers` STILL has no caller.** This makes the questionnaire capable of expressing
what the profile requires — **a precondition for a surface, not a surface.**

- **D5's `/discovery` form is NOT authorized by this.** It needs its own `Status: Proposed` ADR;
  `apps/web` does not depend on `@age/business-discovery-contracts` today, and that dependency is
  itself a decision.
- **D6 holds untouched:** no authorship, no scope, no persistence, no HTTP route. ADR-0050 D5/D7's
  two named blockers are unchanged — Path B stamps `changedBy`/`constructedAt` onto every
  `FieldVersion`, and `buildContextReadinessReport`'s hardwired `demoContext` would stamp a demo
  scope onto a real business's data.
- **ADR-0051 §2.1's five items remain recorded, NOT authorized.** Each needs its own ADR.

## 7. Nothing remains on this track

D1–D4 are complete. ADR-0051's dissent 2 — the skeptic's standing objection that every slice ends
with the function still uncalled — now applies with full force: **the ADR itself says this was the
last deferral that argument can carry.** The next slice on this line should be a surface, and it
needs its own ADR.
