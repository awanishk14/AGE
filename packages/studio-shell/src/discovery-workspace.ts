/**
 * Where the operator's discovery drafts and answer files live.
 *
 * ⚠️ The operator names the directory. 🚫 It is never defaulted, never searched
 * for and never placed inside the repository (ADR-0054 D2/D3) — the console
 * writes only where it was told to write.
 *
 * Pure: no filesystem, no `process`, no clock. The environment arrives as an
 * argument, and path composition is string work the caller performs.
 */

export const DISCOVERY_WORKSPACE_VARIABLE = 'AGE_DISCOVERY_WORKSPACE';

export type DiscoveryWorkspace =
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'configured'; readonly directory: string };

export function resolveDiscoveryWorkspace(
  environment: Readonly<Record<string, string | undefined>>,
): DiscoveryWorkspace {
  const raw = environment[DISCOVERY_WORKSPACE_VARIABLE];

  // ⚠️ Blank counts as UNSET, so the operator is told they never named a
  // directory rather than that the one they named is malformed.
  if (raw === undefined || raw.trim() === '') {
    return { kind: 'not-configured', variable: DISCOVERY_WORKSPACE_VARIABLE };
  }

  // 🚫 Not trimmed. Repairing what the operator typed means writing somewhere
  // they did not name.
  return { kind: 'configured', directory: raw };
}

/** Refusal raised when a clientId cannot be used to compose a file name. */
export class UnsafeClientIdError extends Error {
  constructor() {
    // 🚫 The offending id is NOT echoed. It reached us from a URL; repeating it
    // in a message that may be logged is how an injected string travels.
    super(
      'The business identifier cannot be used to name a file. Only letters, digits, hyphens, ' +
        'underscores and dots are accepted, and it may not begin with a dot.',
    );
    this.name = 'UnsafeClientIdError';
  }
}

/**
 * ⚠️ THE PATH-TRAVERSAL GUARD. A `clientId` arrives from the URL. Composing a
 * file name from it unchecked would let `../../etc/anything` address a file
 * outside the workspace the operator named — and the workspace guard would not
 * catch it, because the composed path would still start inside the directory.
 *
 * 🚫 The id is REFUSED, never sanitised: silently rewriting it would write the
 * draft to a file whose name is not the business the operator is looking at.
 */
export function assertSafeClientIdForFileName(clientId: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(clientId) || clientId.includes('..')) {
    throw new UnsafeClientIdError();
  }
}

export function draftFileNameFor(clientId: string): string {
  assertSafeClientIdForFileName(clientId);
  return `${clientId}.discovery-draft.json`;
}

export function answerFileNameFor(clientId: string): string {
  assertSafeClientIdForFileName(clientId);
  return `${clientId}.discovery-answers.json`;
}

/**
 * Where the answers a human confirmed **from a source** are kept (ADR-0073 D1).
 *
 * 🛑 **A THIRD, SEPARATE FILE — 🚫 never a section inside the answer file and
 * 🚫 never a section inside the draft.** The answer file is hand-authored and
 * stays `stated`-only (D2); the discovery draft holds the operator's typing.
 * Merging any two of the three would make one channel's rules apply to another's
 * entries.
 */
export function sourceConfirmedFileNameFor(clientId: string): string {
  assertSafeClientIdForFileName(clientId);
  return `${clientId}.source-confirmed.json`;
}
