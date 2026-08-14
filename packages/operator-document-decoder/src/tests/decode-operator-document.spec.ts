import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { decodeOperatorDocument } from '../decode-operator-document';
import { buildMinimalPdf } from './minimal-pdf';

/**
 * 🛑 **THESE TESTS DECODE A REAL PDF.** `unpdf` is not stubbed anywhere in this
 * file — the bytes are a genuine, well-formed PDF and the library opens them.
 * A suite that mocked the decoder would prove the wiring type-checks and would
 * 🚫 NOT answer the only question ADR-0070 D2 asked, which is whether the chosen
 * library reads documents.
 */

const FICTIONAL_LINES = [
  'Fictional Kite Repair operates from a single workshop.',
  'It serves hobbyists and two fictional coastal clubs.',
];

describe('decodeOperatorDocument — a real document, actually decoded (ADR-0070 D2)', () => {
  it('🛑 READS A REAL PDF, and returns the document’s own words', async () => {
    const decode = await decodeOperatorDocument(buildMinimalPdf(FICTIONAL_LINES));

    expect(decode.kind).toBe('decoded');
    if (decode.kind !== 'decoded') return;

    // ⚠️ Asserted on CONTENT, never on length — a character count says nothing
    // about a business, and rendering one as an assessment is the D7 failure.
    expect(decode.text).toContain('Fictional Kite Repair');
    expect(decode.text).toContain('two fictional coastal clubs');
    expect(decode.documentKind).toBe('decoded-pdf');
  });

  it('⚠️ IS DETERMINISTIC — the same bytes decode to the same text', async () => {
    const bytes = buildMinimalPdf(FICTIONAL_LINES);
    const first = await decodeOperatorDocument(bytes);
    const second = await decodeOperatorDocument(buildMinimalPdf(FICTIONAL_LINES));

    expect(first).toEqual(second);
  });

  it('🛑 A PDF WITH NO TEXT LAYER IS ITS OWN FACT — 🚫 never "empty"', async () => {
    // ⚠️ A PDF that opens perfectly and carries no text is what a SCAN looks
    // like. 🚫 Reading its words would be OCR (ADR-0070 D4, refused by name).
    const decode = await decodeOperatorDocument(buildMinimalPdf([]));

    expect(decode.kind).toBe('decoded-no-text');
    // 🚫 It must NOT arrive as the successful arm carrying an empty string.
    expect(decode).not.toHaveProperty('text');
  });

  it('🛑 A DAMAGED PDF IS `could-not-decode` — 🚫 never raw bytes as text', async () => {
    // ⚠️ The header says PDF, so this is NOT `no-decoder`: AGE was asked to
    // decode a PDF and could not, which is a different fact from "AGE does not
    // decode this format".
    const damaged = new TextEncoder().encode('%PDF-1.4\nthis is not a pdf body at all\n');

    const decode = await decodeOperatorDocument(damaged);

    expect(decode.kind).toBe('could-not-decode');
    // 🚫 ADR-0070 D3: no fallback to reading the bytes as text. If it had one,
    // the operator would be shown "this is not a pdf body at all" as though the
    // document had said it.
    expect(decode).not.toHaveProperty('text');
  });

  it("🚫 A DECODE FAILURE CARRIES NO LIBRARY MESSAGE — 🚫 not the document's bytes", async () => {
    const decode = await decodeOperatorDocument(
      new TextEncoder().encode('%PDF-1.4\nFictional Kite Repair confidential\n'),
    );

    // 🚫 A pdf.js error can quote the file it failed on, and those bytes are a
    // real client's words. The outcome carries a NAME and nothing else.
    expect(Object.keys(decode).sort()).toEqual(['documentKind', 'kind']);
    expect(JSON.stringify(decode)).not.toContain('Fictional Kite Repair');
  });

  it('⚠️ DECIDES FROM THE BYTES, 🚫 NEVER FROM A FILE EXTENSION', async () => {
    // Plain text — no PDF header — is `no-decoder`, which is 🚫 not a failure:
    // the caller's existing plain-text path handles it.
    const decode = await decodeOperatorDocument(
      new TextEncoder().encode('Fictional Kite Repair serves hobbyists.'),
    );

    expect(decode.kind).toBe('no-decoder');
  });

  it('⚠️ AN EMPTY FILE IS `no-decoder`, 🚫 not a broken PDF', async () => {
    expect((await decodeOperatorDocument(new Uint8Array())).kind).toBe('no-decoder');
  });

  it('🚫 THE MODULE REACHES NO NETWORK, NO FILESYSTEM AND NO MODEL', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../decode-operator-document.ts', import.meta.url)),
      'utf8',
    );
    // ⚠️ Comments stripped first: this file's own explanation of what it must
    // never do would otherwise match the tokens it explains.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    expect(code.length).toBeGreaterThan(0);
    let examined = 0;
    for (const banned of [
      'fetch(',
      'node:fs',
      'node:https',
      'readFileSync',
      'process.env',
      'new Date(',
      'Math.random(',
      'anthropic',
      'openai',
      'tesseract',
      'ocr',
    ]) {
      expect(code.toLowerCase(), banned).not.toContain(banned.toLowerCase());
      examined += 1;
    }
    // ⚠️ Counted after the loop: a scan that examined nothing must never be
    // able to report compliance.
    expect(examined).toBe(11);
  });
});
