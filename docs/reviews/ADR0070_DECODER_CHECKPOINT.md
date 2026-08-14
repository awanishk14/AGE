# ADR-0070 — the decoder track, verbatim record

> The per-slice record for ADR-0070 (the D4.2 decoder). ⚠️ **Append, never rewrite.**
> `CLAUDE.md` carries only pointers to this file — 🚫 do not act on the decoder track from a
> summary line there.

---

## §1 — D2 was answered by the Product Owner (2026-08-15)

The five options in §3 D2 were read back **verbatim from the ADR**, each with its concrete
implementation consequence and the architect's recommendation (**D then B**). The owner selected:

> **D — `unpdf`, PDF only.** MIT, zero runtime dependencies, in-process.
> Option **B** (`mammoth`, DOCX) **deferred to its own slice**.

🚫 **NOT self-accepted, and 🚫 not an echo of the recommendation** — the recommendation was D **and**
B in sequence; the owner took D and deferred B. ⚠️ Per finding 7, the owner's selection is 🚫 not
independent corroboration of the architect's reasoning.

⚠️ **The acceptance is bounded by ADR-0070 §0.1b** — read it, 🚫 not this line. The bound most
easily lost: 🛑 **OPTION B IS NOT PRE-AUTHORIZED BY THE PACKAGE EXISTING.** "The decoder package is
already there, adding `mammoth` is just a dependency line" is the exact argument §0.1b refuses.
DOCX stays `not-plain-text`, refused by name, until the owner decides it in its own slice.

---

## §2 — What shipped (one slice, PR #330)

**A real PDF on the operator's disk is now decoded on their machine and its own sentences shown to
them, with no fabricated value anywhere and no effect on any score.**

### §2.1 — The shape, and why it is this shape

- 🛑 **`@age/operator-document-decoder` EXISTS SO THAT `@age/assisted-intake` DOES NOT** (D1). The
  pure package gained 🚫 no dependency, 🚫 no `node:fs`, 🚫 no buffer handling and 🚫 no branch on a
  file extension. It receives **text plus a statement of how that text was obtained**, and it stays
  the one place extraction _semantics_ live.
- 🛑 **THE DECODER IS AN ARGUMENT, 🚫 NOT A RUNTIME MEMBER.**
  `readOperatorSourceDocument(runtime, decode, options)` takes it as a parameter, and
  `@age/operator-workspace` types it **structurally** rather than importing it. A member on
  `OperatorWorkspaceRuntime` would let **`apps/mcp` bind one**, and 🚫 no MCP surface is authorized
  to decode a real client's documents. ⚠️ This is D1 enforced by shape, 🚫 not by promise.
- 🛑 **THE FORMAT IS DECIDED FROM THE BYTES, 🚫 NEVER FROM THE EXTENSION** (`%PDF-`). A `.pdf` that
  is not a PDF and a PDF saved as `.txt` are both routine; an extension is a claim by whoever named
  the file, the header is the document's own statement about itself.
- 🛑 **THE PATH POLICY STILL RUNS FIRST.** `assertOperatorFilePathOutsideRepository` executes
  **before** the `await` and before any read (ADR-0054 D2). ⚠️ Making `loadSourceDocument` async did
  not move it — 🚫 do not reorder it behind a decode.
- 🚫 **THE BYTES NEVER LEAVE THE MACHINE.** No network call, no service, no native module, 🚫 no
  model call (ADR-0059 D5 stands). ⚠️ This is the property that made route 2 rank above route 3 at
  all, and it must survive every future edit.
- ⚠️ `readFileBytes` copies out of the Buffer (`new Uint8Array(readFileSync(path))`) rather than
  wrapping the shared pool, so 🚫 nothing downstream can see another read's memory.

### §2.2 — Four outcomes, all distinct, 🚫 none collapsible

🛑 **MERGING ANY TWO WOULD PRODUCE EXACTLY THE SILENCE ADR-0059 D7 EXISTS TO PREVENT.**

| Outcome            | What it means                                                                    | 🚫 What it is NOT                                                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `decoded`          | AGE opened a PDF and read text out of it.                                        | —                                                                                                                                                                              |
| `decoded-no-text`  | AGE opened a PDF with **no text layer** — almost always a **scan**.              | 🚫 NOT "the document is empty" and 🚫 NOT "the business said nothing." The page has words a human can see and AGE cannot; reading them would be **OCR, refused by name** (D4). |
| `could-not-decode` | The bytes claim to be a PDF and AGE could not open them (damaged, or encrypted). | 🚫 Never silently retried as text, and 🚫 **never falls back to raw bytes as text** — a mojibake passage the operator might accept as an answer is worse than a refusal (D3).  |
| `no-decoder`       | Not a format AGE decodes.                                                        | ⚠️ **NOT a failure** — the existing plain-text path handles it. A **DOCX lands here**, and stays there until option B ships.                                                   |

- 🛑 **`SourceFileReader` RETURNS A UNION, 🚫 NOT A `string`.** A reader that could only return a
  string would have to signal "I could not decode this" by returning `''`, and an empty string is
  indistinguishable from an empty document. ⚠️ That collapse is the whole reason for the union.
- ⚠️ **A decode failure still REPORTS THE DOCUMENT.** The operator named a file and AGE holds it;
  its `text` is empty because there is none, and the outcome beside it says why **in its own words**,
  so 🚫 no surface can render it as a document that happened to contain nothing.
- 🚫 **A decode failure carries no library message and no bytes** — a pdf.js internal string on an
  operator's screen is neither actionable nor safe.

### §2.3 — Provenance on screen, and the rule it must not break

- ⚠️ `SOURCE_DOCUMENT_KINDS` is now `['plain-text', 'decoded-pdf']` — an **explicit union**, so
  adding a kind stays a visible, reviewable edit in a file that says an ADR is required first.
- 🛑 **PROVENANCE ALONE NEVER CHANGES A SCORE** (AGE-INV-PROV-1). `decoded-pdf` is 🚫 **not** a
  quality badge and 🚫 ranks nothing. What differs is what the operator should **check**: with a
  decode, whether the extraction matches the page.
- ⚠️ **`describeHowItWasRead` has EXACTLY ONE IMPLEMENTATION**, in `@age/operator-workspace`, for
  the same reason `describeNotExtracted` does: the copy that drifts is always the one that starts
  describing the **business** rather than the **file**.
- ⚠️ **The badge is shown ONLY where a decode actually succeeded.** On a `not-extracted` outcome the
  document is still a PDF but its text never arrived, and "Decoded from PDF" beside "proposed
  nothing" would claim a step that did not finish.
- ⚠️ **The Sources screen's authored sentences were re-read and corrected** (the #328 rule): it said
  "no PDF or DOCX is decoded… refused, not pending", which is now false for PDF. 🛑 **A screen
  claiming a blocker the architecture has since removed is as dishonest as one claiming a capability
  that does not exist.**

### §2.4 — The guard, and the mutation that proved it

`packages/operator-document-decoder/src/tests/single-decoder-site.spec.ts` — D1 is structural, and
**prose does not enforce it**. `operator-environment.ts` _claims in a comment_ to be the only
importer; the guard is the shape.

- Asserts the walk **found files first** (>100), so an empty scan can never read as compliance.
- **Strips comments** before scanning, so the files that _explain_ the rule do not trip it.
- Four claims: the decoder package is imported by **`apps/studio/src/server/operator-environment.ts`
  and nothing else** · `unpdf` is named in **one source file** · declared in **one manifest** · and
  imported by **no `packages/*` package at all**.
- ⚠️ **MADE TO FAIL, then restored by a targeted inverse edit** (🚫 not `git checkout`): a real
  `import '@age/operator-document-decoder'` was appended to `@age/assisted-intake`'s barrel; two
  assertions failed and **named the file by path**; the line was removed and all five passed again.
- 🚫 **Do not add an entry to `AUTHORIZED_IMPORT_SITES` to make a failing test pass.** A second site
  is a decision, and a decision lives in an ADR.

### §2.5 — Verified end to end, on a real file

A genuine PDF (built byte by byte, well-formed cross-reference table, obviously fictional content
per ADR-0053 D3 / ADR-0065 D1) was written to a path **outside the repository** and read through the
**real console function** `readOperatorSourceDocument` — not a stub. Result: `kind: 'read'`,
`document.kind: 'decoded-pdf'`, the decoded text verbatim, one proposed passage, and the notice
telling the operator AGE decoded it locally and that the judgement is theirs. ⚠️ **The fixture is a
real PDF on purpose** — a test that stubs `unpdf` proves the wiring compiles and nothing else, which
is precisely the question D2 put to the owner.

### §2.6 — What this slice did 🚫 NOT do

🚫 No OCR. 🚫 No model call. 🚫 No URL fetch, widget, upload endpoint or file picker reaching a
network path. 🚫 No DOCX. 🚫 No second path policy, 🚫 no default path and 🚫 no default decoder
(ADR-0049 D2). 🚫 **Nothing auto-mapped** — the operator still chooses which sentence answers which
question, one passage at a time. 🚫 No score moved, no BIF field moved, no status promoted.
🚫 `apps/mcp` decodes nothing and **says so by shape**: it supplies "no decoder claims this file" for
every document, which leaves its tool on route 1, exactly as before.

---

## §3 — What the decoder track still owes

⚠️ Each needs its **own `Proposed` ADR**, read in its own words (ADR-0070 §5 — 🚫 **not a to-do
list**): option **B**/DOCX · **D4.3** a website URL (an SSRF surface in a process that reads the
operator's local filesystem — an allow-list decision, 🚫 not a checkbox) · **D4.4** a widget
(**refused, not postponed**) · **D5** model-based extraction (must name the vendor, the data-handling
terms, what is redacted, and who at the client consented) · **OCR** · and a size/page limit **only if
a real operator hits one** — ⚠️ the trigger is a real document, 🚫 not a prediction.
