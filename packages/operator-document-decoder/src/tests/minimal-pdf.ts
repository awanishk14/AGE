/**
 * A REAL PDF, built byte by byte, for the decoder's tests.
 *
 * 🛑 **THE POINT IS THAT NOTHING HERE IS A MOCK.** A test that stubs `unpdf`
 * proves the wiring compiles and nothing else — it cannot tell you whether the
 * chosen library actually reads a PDF, which is the entire question ADR-0070 D2
 * put to the Product Owner. So these bytes are a genuine PDF: `unpdf` opens
 * them the same way it would open an operator's document.
 *
 * ⚠️ **EVERY STRING IS OBVIOUSLY FICTIONAL** (ADR-0053 D3, ADR-0065 D1). A
 * realistic business document here would be a real client record living in the
 * repository, which is refused — and obvious fictionality is itself the guard.
 *
 * ⚠️ Pure and deterministic: no clock, no randomness, no filesystem. The same
 * lines yield the same bytes, so a decode failure is always about the decoder.
 */

/** PDF strings escape these three characters and nothing else here. */
function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/**
 * Builds a single-page PDF whose text layer is `lines`, one line per entry.
 *
 * ⚠️ The cross-reference table offsets are computed from the assembled bytes
 * rather than guessed, so this is a **well-formed** PDF — a decoder that only
 * succeeds because pdf.js repairs a broken file would be telling us nothing.
 */
export function buildMinimalPdf(lines: readonly string[]): Uint8Array {
  // ⚠️ `Tj` with a leading `T*` per line: the simplest operator sequence that
  // produces separate text items, which is what an extractor joins.
  const content = [
    'BT',
    '/F1 12 Tf',
    '14 TL',
    '72 720 Td',
    ...lines.map((line) => `(${escapePdfText(line)}) Tj T*`),
    'ET',
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
      '/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${String(content.length)} >>\nstream\n${content}\nendstream`,
  ];

  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${String(index + 1)} 0 obj\n${object}\nendobj\n`;
  });

  const startXref = body.length;
  // ⚠️ Every xref entry is exactly 20 bytes — a PDF requirement, and the one
  // detail a hand-built file most often gets wrong.
  const xref = [
    'xref',
    `0 ${String(objects.length + 1)}`,
    '0000000000 65535 f ',
    ...offsets.map((offset) => `${offset.toString().padStart(10, '0')} 00000 n `),
  ].join('\n');

  const document =
    `${body}${xref}\n` +
    `trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\n` +
    `startxref\n${String(startXref)}\n%%EOF\n`;

  return new TextEncoder().encode(document);
}
