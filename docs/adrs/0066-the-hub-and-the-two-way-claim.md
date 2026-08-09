# ADR-0066 — The hub, and what "two-way" may and may not mean

Status: **Proposed** (2026-08-09, by the architect — this is a **decision request**, not a
self-acceptance; §7 lists what only the Product Owner may answer)

Supersedes: nothing. Depends on: ADR-0053 D3/D5, ADR-0054 D7, ADR-0057 D4 + OX-INV-1,
ADR-0059 D3/D4.2/D4.3/D5, ADR-0061 §5, ADR-0062 D1–D3.

---

## 1. The goal, restated in the owner's words and then corrected

The Product Owner's statement: _"we want all disconnected tools to pass info to AGE for getting
uniformed information to make decision. AGE has multiple apps communicating to it and it has to be
2-way communication so all other tools benefit from each other."_

**Three of the four clauses are already the architecture.** AGE is a hub; many sources feed one
unified picture; other tools read that picture back. `produceScoredBifContext` is the single
Discovery→BIF mapping, `@age/operator-workspace` is the single orchestration, and `apps/mcp`
already serves eleven tools over that same implementation to any MCP client. **An external tool
reading the unified picture back out is shipped and working today.**

**One clause needs correcting, and it is the load-bearing one.** "Two-way, so all other tools
benefit from each other" reads naturally as _AGE writes back into the source tools, and the tools
sync with one another_. That is a **different and much larger** system than the one being built,
and adopting it silently would repeal ADR-0057 D4 (class 3 — AGE never acts on a business's
behalf). This ADR therefore distinguishes:

- **Two-way as READ-BACK** — a tool pushes facts in; any tool may pull the unified picture out,
  whole, with each claim's origin attached. Every tool benefits from every other tool's
  contribution _through AGE_, without AGE touching any of them. ✅ This is the goal, and it is
  most of the way built.
- **Two-way as WRITE-BACK** — AGE pushes changes into a source tool (updates a CRM record, posts
  an ad change). 🛑 **Refused here**, class 3 under ADR-0057 D4. It needs its own ADR, its own
  authorization model, and a Product Owner decision about liability.

**D1. "Two-way" means read-back, not write-back. AGE is a hub with an inbound and an outbound
read surface, and no outbound _write_ surface to any external system.**

---

## 2. What actually exists today (audited, `main` @ `6eece6d`)

| Clause of the goal                    | State                                                                                                                                                                      |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A single unified picture              | ✅ `produceScoredBifContext` — one mapping, no second path                                                                                                                 |
| Many sources feed it                  | ❌ **One** source: a human typing into the questionnaire                                                                                                                   |
| Other tools read it back              | ✅ `apps/mcp` — 11 tools, stdio JSON-RPC, same implementation                                                                                                              |
| Each claim carries its origin         | ⚠️ **The type exists and nothing reads it** (see D2)                                                                                                                       |
| Tools push info _in_ over a network   | ❌ **No ingest endpoint exists.** `apps/api` has exactly two live routes (`GET /health`, `GET /demo/capabilities`); all 21 domain controllers carry no HTTP verb decorator |
| Anyone but the developer can reach it | ❌ Studio is loopback-pinned by construction; `deploy/vps/` has no app service                                                                                             |
| Authorization                         | ❌ `askEntitlement(` has **zero callers**, proven by a repo-wide guard. Ten auth/tenancy/audit packages have zero application importers                                    |

**Plain answer to "are we ready": the hub is real, the read-back is real, and there is exactly one
source feeding it. We are not ready, and the missing piece is not the network — it is that the
picture cannot yet say where a claim came from.**

---

## 3. The finding that reorders everything

`@age/assisted-intake` (#269) produces answers stamped `confirmed-from-source`. It has **zero
importers**. Wiring it is tempting and would be wrong today, because:

1. `build-profile-from-answers.ts` contains **no occurrence of the token `provenance`**. A
   `confirmed-from-source` answer and a typed answer produce an **identical** profile.
2. The canonical Answer File **structurally cannot hold** a second source:
   `parse-discovery-answer-file.ts:278` hard-codes `STATED_ANSWER_PROVENANCE`, deliberately, and
   says an extraction surface must hand its candidates to _something else_ — and nobody has
   decided what that something else is.
3. **`fieldEvidence` is not an inert carrier.** It is read at `completeness-scoring.ts:318` and
   `:619` (evidenced sections escape `uncitedEvidenceCap`) and at
   `business-discovery-to-bif.ts:396-398, 429` (it decides each field's `FieldSource`). Populating
   it to carry provenance would **move the pinned 98/63 vs 12/17 baseline** (ADR-0054 D7) and
   would convert "a document said it" into "we are more confident" — refused by ADR-0059 D3.

**D2. Answer provenance travels on a channel the scorers cannot see.** It is carried alongside the
profile, never inside `fieldEvidence` and never inside `evidenceSources`. A test asserts that a
profile built from a mixed stated/confirmed answer set yields **byte-identical scores** to one
built from the same answers all marked `stated`.

**D3. A source that cannot be named is not a source.** An answer whose provenance is
`confirmed-from-source` must carry its `sourceId`, `locator` and `confirmedBy`, or it is refused —
🚫 never defaulted to `stated`. Losing provenance silently is worse than refusing the answer,
because it launders a document's words into "what the business said".

**D4. The durable home for a confirmed answer is the DRAFT, extended — not the Answer File.** The
Answer File stays `stated`-only and byte-identical; its parser keeps its hard-coded provenance.

---

## 4. What a second source may not do

**D5. Ingest never promotes.** A pushed fact enters as an answer candidate an operator confirms.
🚫 No source writes a BIF, no source moves a status, no source produces a score. ADR-0059's
"the extractor proposes passages, not answers" generalises to every future source.

**D6. Every inbound surface names its source, and an unknown source is refused** — 🚫 never
recorded as "unknown" and never attributed to the operator.

**D7. `askEntitlement` is called before any inbound surface accepts a byte.** Today it has no
caller by design. The first inbound network endpoint is the slice that must give it one — 🚫 an
ingest endpoint shipped before that call is an unauthenticated write to a client's record.

---

## 5. The proposed order (each its own slice, each its own PR)

| #   | Slice                                                               | Why here                                                                                            |
| --- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | **This ADR** accepted                                               | Nothing below is authorized without it                                                              |
| 2   | The mapper carries provenance on the D2 channel                     | The only true blocker; nothing else needs building twice                                            |
| 3   | The draft learns provenance; Answer File output byte-identical      | D4                                                                                                  |
| 4   | Wire `@age/assisted-intake` + a Studio **Sources** screen           | Second source becomes real; discharges the standing "a backend capability needs a Studio home" rule |
| 5   | BIF panel shows, per field, which source it came from               | 🚫 Two labels, never merged (ADR-0064)                                                              |
| 6   | Two MCP tools expose the multi-source picture, serialised **whole** | The read-back clause, now honestly multi-source                                                     |

**After slice 6 the goal is demonstrable end to end on one machine, with zero deployment and zero
reversal of any shipped decision.**

Everything network-facing — the ingest endpoint, login, the session store rows, the deployed app
service — sits **after** §7 Q1 and is blocked on the owner, not on work.

---

## 6. Dissent recorded

A council of four lenses ran on the code (not on my prose). The sequencing lens recommended
carrying provenance **in `fieldEvidence`**, naming as its own highest-risk assumption that
"provenance is inert", and proposed a 15-minute falsification. **The experiment was run and the
assumption is false** — the two call sites in §3 item 3. Its evidence is adopted; its
implementation conclusion is rejected and replaced by D2. The security lens leaned in places on my
own handover prose rather than the code; its ADR-status claims were re-verified directly before
use. The audit lens could not determine whether any real snapshot row exists in a live database —
that is runtime state outside the repo and remains unverified here.

---

## 7. 🛑 Questions only the Product Owner may answer

1. **ADR-0061 §5 — which product is hosted?** Still open. Blocks every network slice. 🚫 Not to be
   answered in code.
2. **Does "all other tools benefit from each other" mean read-back (D1) or write-back?** If
   write-back, D1 is wrong and a much larger ADR is owed. My recommendation is read-back.
3. **Is a plain-text-only pilot acceptable?** Real businesses send PDFs; ADR-0059 D4.2 refuses
   them by name until a decoder is chosen. This decides whether the second source is realistic or
   a demo.
4. **Does "a real human other than the developer" mean a second operator, or the business owner?**
   ADR-0062 D2 makes a client a _subject_ of isolation, recorded but not authorized. The answer
   changes slice 7 entirely.
