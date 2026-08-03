import { readFileSync } from 'node:fs';

import {
  ClientRecordFileError,
  loadClientRecordFile,
  type ClientRecord,
} from '@age/client-registry';
import {
  presentBusinesses,
  resolveClientRecordSource,
  type BusinessesView,
} from '@age/studio-shell';
import { OperatorFilePathRefusedError } from '@age/operator-file-policy';

/**
 * The ONE module in `apps/studio` that performs an effect.
 *
 * ⚠️ This is the `apps/capture` discipline, deliberately repeated: every
 * DECISION lives in `@age/studio-shell` and every EFFECT lives here, so a purity
 * guard can assert that no other module grew its own clock, filesystem read or
 * environment lookup. 🚫 Do not read `process.env` or open a file anywhere else
 * under `src/`.
 *
 * 🚫 Nothing here caches. A cached registry would keep serving a file the
 * operator has since corrected, and "the screen disagrees with the file" is
 * precisely the failure this console exists to make impossible.
 */

/** The repository working tree, which operator files must live outside of. */
function repositoryRoot(): string {
  // ⚠️ `process.cwd()` is used ONLY to locate the repository the file must be
  // OUTSIDE of — never to find the file itself. That distinction is ADR-0054
  // D2: searching the working directory for an operator's file is the refused
  // behaviour; knowing which tree to exclude is the guard that enforces it.
  return process.cwd();
}

/**
 * Read the operator's client records, or explain why not.
 *
 * ⚠️ Every failure becomes a REFUSED view carrying the reason. 🚫 None becomes
 * an empty list: "nobody told me where to look" and "there are no businesses"
 * must never render the same way.
 */
export function readBusinessesView(): BusinessesView {
  const source = resolveClientRecordSource(process.env);

  if (source.kind === 'not-configured') {
    return { kind: 'not-configured', variable: source.variable };
  }

  try {
    const records = loadClientRecordFile({
      path: source.path,
      repositoryRoot: repositoryRoot(),
      readFileText: (path) => readFileSync(path, 'utf8'),
    });

    return presentBusinesses(records);
  } catch (error) {
    if (error instanceof ClientRecordFileError || error instanceof OperatorFilePathRefusedError) {
      // ⚠️ These messages are already written to name a POSITION and never the
      // record's contents, so surfacing them cannot carry a client's name onto
      // the screen of a console that is showing the wrong file.
      return { kind: 'refused', reason: error.message };
    }

    // 🚫 An unexpected error is NOT flattened into a generic refusal with the
    // underlying message attached — an unrecognised error could carry anything,
    // including file contents from a layer that made no promise about them.
    return {
      kind: 'refused',
      reason:
        'The client record file could not be read, and the failure was not one the console ' +
        'recognises. Nothing is shown rather than a partial or repaired registry.',
    };
  }
}

/**
 * What a subject screen knows about the business named in its URL.
 *
 * ⚠️ Four outcomes again, and the last one is the load-bearing case: a clientId
 * that is not in the operator's record file is REFUSED, never rendered as a
 * business with no data. Continuing would put a scope into circulation that
 * names nothing (ADR-0054 D3).
 */
export type BusinessScope =
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'refused'; readonly reason: string }
  | { readonly kind: 'unknown-client'; readonly clientId: string }
  | { readonly kind: 'resolved'; readonly client: ClientRecord };

/**
 * Resolve the business a subject route names.
 *
 * 🚫 No nearest match, no "did you mean", and 🚫 the refusal does NOT list the
 * known ids — the requested id came from the operator and is already theirs;
 * the others are other clients' names.
 */
export function resolveBusinessScope(clientId: string): BusinessScope {
  const view = readBusinessesView();

  switch (view.kind) {
    case 'not-configured':
      return { kind: 'not-configured', variable: view.variable };
    case 'refused':
      return { kind: 'refused', reason: view.reason };
    case 'none':
      return { kind: 'unknown-client', clientId };
    case 'listed': {
      const client = view.bands
        .flatMap((band) => band.clients)
        .find((candidate) => candidate.clientId === clientId);

      return client === undefined
        ? { kind: 'unknown-client', clientId }
        : { kind: 'resolved', client };
    }
  }
}

/** The host the console was started on. Reported as a fact, never as a promise. */
export function boundHost(): string {
  return process.env.AGE_STUDIO_HOST ?? '127.0.0.1';
}

/** The port the console was started on. */
export function boundPort(): number {
  const raw = process.env.PORT ?? process.env.AGE_STUDIO_PORT;
  const parsed = raw === undefined ? Number.NaN : Number.parseInt(raw, 10);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 3100;
}
