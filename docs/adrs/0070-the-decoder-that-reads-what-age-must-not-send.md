# ADR-0070 — The decoder that reads what AGE must not send anywhere

Status: **Proposed** (2026-08-14)
🚫 **This is a decision request. It authorizes NOTHING on its own, and it must 🚫 NOT be
self-accepted** — it names a third-party dependency that will be handed a real client's documents,
which is a disclosure-shaped decision, not a sequencing one.

Depends on: ADR-0059 **D4 route 2** (the refusal this ADR exists to answer), ADR-0059 **D1/D2/D7**,
ADR-0054 **D2** (an operator file's path is never defaulted), ADR-0053 **D3** (a real client's
records are never committed), ADR-0057 **D4** (the three action classes), ADR-0046 **D7**, and
§3 of the working handover (no external APIs, no URL fetching, no model calls).
Supersedes: nothing.

---

## 1. The question

ADR-0059 D4 ranked four routes by what each asks AGE to give up, and drew its line between routes 2
and 3. Route 1 — a plain-text file the operator already has — was **allowed** and is **shipped**.
Route 2 — the same act, on a PDF or a DOCX — was ruled **"Allowed, subject to naming the library in
a follow-up ADR."**

That follow-up was never written, so route 2 has stood **refused by name** ever since. This ADR is
that follow-up, and it asks exactly one question:

> 🛑 **Which decoder, if any, may AGE hand a real client's document to — and where in the codebase
> is it allowed to live?**

⚠️ **It is 🚫 not a request to widen D4.** Routes 3 (a website URL) and 4 (a widget) stay exactly as
ADR-0059 left them: route 3 refused pending its own ADR with its own allow-list decision, route 4
**refused, not postponed**. 🚫 Acceptance of anything here is not acceptance of either.

---

## 2. What is already true on `main` — measured, 🚫 not recalled

⚠️ Measured at `a1c83f4`. The shape below is the reason this decision is smaller than it sounds.

- **`@age/assisted-intake` performs NO I/O.** `loadSourceDocument` takes an injected
  `readFileText: (path: string) => string`, runs `assertOperatorFilePathOutsideRepository` **before**
  anything is opened, and splits the returned text into passages. Every decision in the package is
  pure; the single effect lives at the caller's edge.
- **The only capability handed in is a READER.** There is no writer, no fetcher and no client, which
  is precisely why a `fetch` in that package would be D4.3 arriving without its ADR.
- **The path policy has exactly ONE implementation** (`@age/operator-file-policy`, ADR-0054 D2/D3),
  it refuses relative paths outright, and it is not defaulted anywhere.
- **A read failure is never degraded into "the document was empty"** — `SourceDocumentReadError` is
  raised, because a file that was never opened and a file with nothing in it are different facts.
- The route is wired through `@age/operator-workspace` and `@age/studio-shell` to the console's
  Sources surface; `@age/assisted-intake` exports exactly two `accept*` names.

🛑 **The consequence is the whole design of this ADR: a decoder is a WIDER READER, 🚫 not a new
capability.** Today the injected function turns a path into text by reading UTF-8. A decoder turns a
path into text by reading bytes and decoding them. **The seam already exists.** Nothing in the pure
package changes, no new port is introduced, and the dependency lands in exactly one place.

---

## 3. The decision requested

### D1 — Where the decoder may live (🛑 this one is structural, and it is not optional)

**Proposed:** whichever library is chosen, it is imported **only** from the console's single effects
module (`apps/studio/src/server/operator-environment.ts`) or a dedicated effects-only package it
owns — **never** from `@age/assisted-intake`, and **never** from any pure package.

- 🚫 **`@age/assisted-intake` gains no dependency, no `node:fs`, no buffer handling and no branch on
  file extension.** It keeps receiving text and keeps not knowing where text came from.
- ⚠️ The decoder is therefore **one function at the edge**, of the same shape the reader already has,
  and it is replaceable without touching a single pure test.
- 🚫 **No second implementation of the path policy.** The decoder runs **after**
  `assertOperatorFilePathOutsideRepository`, never before, and never instead.

### D2 — Which decoder (the selection this ADR asks for)

Facts below were read from the npm registry on 2026-08-14. ⚠️ They are the **grounds**, 🚫 not the
recommendation.

| Option                               | Format(s)  | License      | Runtime deps                                                                                               | What it costs                                                                                                           |
| ------------------------------------ | ---------- | ------------ | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **A — none. Route 2 stays refused.** | —          | —            | —                                                                                                          | The operator converts to `.txt`/`.md` themselves. **Zero new supply chain.** The cost is real manual work per document. |
| **B — `mammoth` for DOCX only**      | DOCX       | BSD-2-Clause | **8** (`jszip@~2.5`, `bluebird`, `underscore`, `sax`, `lop`, `argparse`, `xmlbuilder`, `path-is-absolute`) | DOCX is the format an operator most often receives. ⚠️ But the dependency tail is long and several entries are old.     |
| **C — `pdfjs-dist` for PDF only**    | PDF        | Apache-2.0   | **0**                                                                                                      | Mozilla's own build, no transitive tail, but a large package, and text extraction is a lower-level API than the others. |
| **D — `unpdf` for PDF only**         | PDF        | MIT          | **0** (optional peer `@napi-rs/canvas`)                                                                    | A thin text-extraction wrapper over pdf.js with a much smaller surface than using `pdfjs-dist` directly.                |
| **E — both formats**                 | PDF + DOCX | mixed        | 8+                                                                                                         | The complete route 2. Two supply chains at once.                                                                        |

⚠️ **Named so it is not discovered later:** `pdf-parse` (Apache-2.0) is the familiar choice, but its
current major depends on `pdfjs-dist@^5` while `pdfjs-dist` itself is at 6.x — adopting it means
carrying a second, older copy of the same engine. 🚫 That is a reason to name it here, not a reason
to treat it as disqualified without the owner seeing it.

🚫 **No option here is a native module, a service, or a network call.** Every candidate decodes
bytes in-process. ⚠️ **The bytes never leave the machine — that is the entire reason route 2 was
ranked below route 3**, and it is the property that must survive whichever option is chosen.

**The architect's recommendation is D + B in that order, arriving as two separate slices** — PDF
first because it is the format an operator is least able to convert by hand, and `unpdf` because
zero runtime dependencies is the cheapest possible way to cross this line. 🚫 **The recommendation is
not the decision, and 🚫 the owner selecting it would not be independent corroboration of it**
(finding 7).

### D3 — What a decode failure means

**Proposed:** a document that cannot be decoded is **`could-not-decode`, with its reason** — its own
outcome, carried alongside the source, exactly as ADR-0059 D7 keeps "sources read" and "facts found"
apart.

- 🚫 **It is never rendered as an empty document, and never as "this document contained nothing."**
  A scanned PDF with no text layer has not told AGE that the business has nothing to say.
- 🚫 **It never falls back to reading the raw bytes as text.** A mojibake passage the operator might
  accept as an answer is worse than a refusal.
- 🚫 **It is not a score, and it moves none.** ADR-0054 D7 governs: a document AGE could not read is
  a limitation, never negative evidence (ADR-0026 D4).

### D4 — What acceptance would 🚫 NOT authorize

🚫 Not OCR — an image-only PDF stays undecodable, and an OCR engine is a separate decision.
🚫 Not a model call of any kind (ADR-0059 D5 stands; the vendor question is untouched).
🚫 Not URL fetching, not a widget, not an upload endpoint, not a file picker that reaches a network
path. 🚫 Not a relaxation of ADR-0054 D2. 🚫 Not any change to how a passage becomes an answer — the
operator still chooses which sentence answers which question, and 🚫 nothing is auto-mapped.
🚫 Not a second path policy, and 🚫 not a default path or a default decoder (ADR-0049 D2).

---

## 4. Why this is put to the owner rather than self-accepted

The §2 mandate lets the architect decide architecture. **D1 and D3 are architecture** and would be
self-acceptable on their own. **D2 is not.** Choosing a decoder decides which third party's code
will be handed a real client's business documents on the operator's machine — the same class of
question ADR-0059 D5 refused to let the architect answer alone, differing only in that the bytes stay
local. ⚠️ A dependency is the one decision that is cheap to make and expensive to unmake.

🚫 **Therefore: no code is written from this ADR until D2 is answered.** If the answer is **A**, that
is a complete answer, and route 2 becomes a **decision** rather than a gap — the same shape ADR-0067
took, and 🚫 it must not then be "fixed" by a helpful patch.

---

## 5. Residual questions — 🚫 NOT a to-do list

Each needs its own `Status: Proposed` ADR, read in its own words:

1. **D4.3, a website URL** — refused pending its own decision; an SSRF surface in a process that
   reads the operator's local filesystem, and it needs an allow-list decision, 🚫 not a checkbox.
2. **D4.4, a widget** — refused, not postponed. 🚫 A "read-only" widget is the same endpoint.
3. **D5, model-based extraction** — must name the vendor, the data-handling terms, what is redacted
   and who at the client consented.
4. **OCR** — out of scope here by name.
5. **A size or page limit** on a decoded document, if a real operator ever hits one. ⚠️ The trigger
   is a real document, 🚫 not a prediction (ADR-0067's rule).
