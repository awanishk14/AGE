import { extractText, getDocumentProxy } from 'unpdf';

/**
 * ADR-0070 **D1 + D2** — the decoder, and the only place `unpdf` is imported.
 *
 * 🛑 **D2 WAS THE PRODUCT OWNER'S DECISION, 🚫 NOT THE ARCHITECT'S** (ADR-0070
 * §0.1). The owner selected **option D — `unpdf`, PDF only** (MIT, zero runtime
 * dependencies), with **option B (`mammoth`, DOCX) deferred to its own slice**.
 * 🚫 Do not add a second decoder here on the grounds that this file already has
 * one: which third party's code is handed a real client's documents is the
 * decision, and it is made once per library, by the owner.
 *
 * 🛑 **THIS PACKAGE EXISTS SO THAT `@age/assisted-intake` DOES NOT** (D1). That
 * package gains no dependency, no `node:fs`, no buffer handling and no branch on
 * a file extension — it stays pure and stays the place extraction *semantics*
 * live. 🚫 Do not import `unpdf` from anywhere else, and 🚫 do not re-export it.
 *
 * 🚫 **THE BYTES NEVER LEAVE THE MACHINE.** `unpdf` decodes in-process. There is
 * no network call, no service, no native module and 🚫 no model call — ADR-0059
 * D5 stands, and ADR-0070 D4 refuses OCR by name. ⚠️ This property is the reason
 * route 2 was ranked above route 3 at all, and it must survive every future edit
 * to this file.
 *
 * 🚫 **NO FILESYSTEM HERE.** The caller reads the bytes; this decides what they
 * are. That keeps the console's single effects module the only thing that
 * touches the operator's disk.
 */

/**
 * ⚠️ **DECIDED FROM THE BYTES, 🚫 NEVER FROM THE FILE EXTENSION.** A `.pdf` that
 * is not a PDF and a PDF saved as `.txt` are both routine, and an extension is a
 * claim by whoever named the file. The header is the document's own statement
 * about itself, so it is the one this reads.
 */
const PDF_MAGIC = '%PDF-';

/**
 * What the bytes turned out to be. ⚠️ **FOUR OUTCOMES, ALL DISTINCT, and 🚫 none
 * of them collapsible into another** — each answers a different operator
 * question, and merging any two would produce exactly the silence ADR-0059 D7
 * refuses:
 *
 * - `decoded` — AGE opened a PDF and read text out of it.
 * - `decoded-no-text` — AGE opened a PDF and it has no text layer at all. ⚠️
 *   Almost always a SCAN. 🚫 This is 🚫 NOT "the document is empty" and 🚫 NOT
 *   "the business said nothing": the page has words a human can see and AGE
 *   cannot. Reading them would be OCR, refused by name (ADR-0070 D4).
 * - `could-not-decode` — the bytes claim to be a PDF and AGE could not open
 *   them (damaged, or encrypted). 🚫 Never silently retried as text.
 * - `no-decoder` — not a format AGE decodes. ⚠️ NOT a failure: the caller's
 *   existing plain-text path handles it, and a DOCX lands here until option B
 *   ships.
 */
export type OperatorDocumentDecode =
  | { readonly kind: 'decoded'; readonly documentKind: 'decoded-pdf'; readonly text: string }
  | { readonly kind: 'decoded-no-text'; readonly documentKind: 'decoded-pdf' }
  | { readonly kind: 'could-not-decode'; readonly documentKind: 'decoded-pdf' }
  | { readonly kind: 'no-decoder' };

function looksLikePdf(bytes: Uint8Array): boolean {
  // ⚠️ Compared over the first bytes only — 🚫 never by decoding the whole file
  // to a string first, which would allocate a copy of a real client's document
  // for the sake of a five-character test.
  if (bytes.length < PDF_MAGIC.length) return false;

  return new TextDecoder('latin1').decode(bytes.subarray(0, PDF_MAGIC.length)) === PDF_MAGIC;
}

/**
 * Decodes one operator-chosen document's bytes.
 *
 * 🚫 **NEVER THROWS AT THE CALLER, AND 🚫 NEVER FALLS BACK TO RAW BYTES AS TEXT**
 * (ADR-0070 D3). A failed decode is its own named outcome carried alongside the
 * source. Rendering a damaged PDF's raw bytes as though they were the business's
 * own words is the single worst thing this path could do, and it is the reason
 * the fallback does not exist rather than being disabled.
 *
 * 🚫 **A DECODE MOVES NO SCORE** and is not one. It is a statement about a FILE.
 *
 * @param bytes the document, read by the caller. 🚫 No path, so 🚫 no second
 *        implementation of the ADR-0054 D2 path policy can grow here.
 */
export async function decodeOperatorDocument(bytes: Uint8Array): Promise<OperatorDocumentDecode> {
  if (!looksLikePdf(bytes)) {
    return { kind: 'no-decoder' };
  }

  let text: string;
  try {
    const proxy = await getDocumentProxy(bytes);
    const extracted = await extractText(proxy, { mergePages: true });
    // ⚠️ `mergePages: true` is TYPED as returning a string, and this still
    // checks. The library decides the shape at RUNTIME from the flag; if a
    // future version returns pages instead, the alternative is joining them —
    // 🚫 never rendering `[object Object]` to an operator as their document.
    const merged: unknown = extracted.text;
    text = typeof merged === 'string' ? merged : (merged as readonly string[]).join('\n');
  } catch {
    // 🚫 The library's own error is NOT carried out of here. It embeds the
    // reason in prose AGE did not author, and a pdf.js message can quote the
    // document's own bytes — which are a real client's words.
    return { kind: 'could-not-decode', documentKind: 'decoded-pdf' };
  }

  // ⚠️ A PDF that opened and yielded nothing is its OWN fact. 🚫 Do not let it
  // become `empty-document` downstream: "there is no text layer in this scan"
  // and "this file has nothing in it" are different things to tell an operator,
  // and only one of them is fixed by finding a better copy of the document.
  if (text.trim() === '') {
    return { kind: 'decoded-no-text', documentKind: 'decoded-pdf' };
  }

  return { kind: 'decoded', documentKind: 'decoded-pdf', text };
}
