/**
 * `@age/operator-document-decoder` — ADR-0070 D1 + D2.
 *
 * 🛑 **THE ONLY PACKAGE IN THIS REPOSITORY THAT DEPENDS ON A DOCUMENT DECODER**,
 * and it is imported by exactly one consumer: `apps/studio`'s single effects
 * module. That is D1, and it is what keeps `@age/assisted-intake` pure.
 *
 * 🚫 **WHAT THIS PACKAGE MUST NEVER GROW** (ADR-0070 D4, refused by name):
 * - 🚫 OCR of any kind. A scan with no text layer is `decoded-no-text`, and
 *   that is the answer, 🚫 not a gap to close.
 * - 🚫 A model call (ADR-0059 D5 stands).
 * - 🚫 A fetch, a URL, an upload endpoint or a widget (D4.3 / D4.4).
 * - 🚫 A path, a filesystem read, or any second copy of the ADR-0054 D2 path
 *   policy — bytes come in, a decode goes out.
 * - 🚫 A DOCX decoder. Option B (`mammoth`) is DEFERRED, 🚫 not pending: it is
 *   its own slice, after its own look at the dependency tail.
 */

export { decodeOperatorDocument } from './decode-operator-document';
export type { OperatorDocumentDecode } from './decode-operator-document';
