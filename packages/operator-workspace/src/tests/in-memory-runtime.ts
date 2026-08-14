import { resolve } from 'node:path';

import type { OperatorWorkspaceRuntime } from '../operator-workspace-runtime';

/**
 * A runtime backed by a `Map`, for the specs.
 *
 * ⚠️ THE POINT IS THAT IT IS NOT THE FILESYSTEM. Before ADR-0060 D2 these nine
 * operations could only be exercised against a real disk, so nothing tested
 * them; the extraction is what makes them testable, and this is the proof.
 *
 * 🚫 It is deliberately NOT exported from the package. A caller reaching for a
 * fake runtime in production would be a surface with no effects at all, which
 * reads as "AGE looked and found nothing" — the failure this repo refuses
 * everywhere else.
 */
export interface InMemoryRuntime extends OperatorWorkspaceRuntime {
  readonly files: Map<string, string>;
  /**
   * Files whose contents are bytes rather than characters (ADR-0070).
   *
   * ⚠️ **SEPARATE FROM `files` ON PURPOSE.** A spec that stored a PDF as a
   * string and re-encoded it would be testing a document AGE could never
   * receive; a real PDF's bytes are not the UTF-8 encoding of any string.
   */
  readonly byteFiles: Map<string, Uint8Array>;
  readonly directories: Set<string>;
  /** Every effect method that was called, in order. */
  readonly calls: string[];
}

/** A tree the operator's files are deliberately OUTSIDE of (ADR-0054 D2). */
export const FIXTURE_REPOSITORY_ROOT = resolve('/fixture-repository');

/** Where the fixture operator keeps their files. 🚫 Obviously fictional, by rule (ADR-0053 D3). */
export const FIXTURE_OPERATOR_DIRECTORY = resolve('/fixture-operator');

/** A fixed instant. ⚠️ Never `new Date()`: a spec that reads the wall clock cannot be re-read later. */
export const FIXTURE_INSTANT = new Date('2026-01-01T00:00:00.000Z');

export function createInMemoryRuntime(
  env: Readonly<Record<string, string | undefined>> = {},
): InMemoryRuntime {
  const files = new Map<string, string>();
  const byteFiles = new Map<string, Uint8Array>();
  const directories = new Set<string>();
  const calls: string[] = [];

  return {
    files,
    byteFiles,
    directories,
    calls,
    env,
    repositoryRoot: () => {
      calls.push('repositoryRoot');
      return FIXTURE_REPOSITORY_ROOT;
    },
    now: () => {
      calls.push('now');
      return FIXTURE_INSTANT;
    },
    fileExists: (path) => {
      calls.push(`fileExists:${path}`);
      return files.has(path);
    },
    readFileText: (path) => {
      calls.push(`readFileText:${path}`);
      const contents = files.get(path);
      if (contents === undefined) {
        // ⚠️ Shaped like Node's failure — a caller that swallows the system
        // error must still take its "no file yet" branch here.
        throw new Error('ENOENT: no such file or directory');
      }
      return contents;
    },
    readFileBytes: (path) => {
      calls.push(`readFileBytes:${path}`);
      const bytes = byteFiles.get(path);
      if (bytes !== undefined) return bytes;

      // ⚠️ A text fixture read as bytes is exactly what the console does to a
      // `.txt` the operator names — the decoder is expected to look at those
      // bytes, find no PDF header, and hand the file back to route 1.
      const contents = files.get(path);
      if (contents === undefined) {
        throw new Error('ENOENT: no such file or directory');
      }
      return new TextEncoder().encode(contents);
    },
    writeFileText: (path, contents) => {
      calls.push(`writeFileText:${path}`);
      files.set(path, contents);
    },
    ensureDirectory: (path) => {
      calls.push(`ensureDirectory:${path}`);
      directories.add(path);
    },
  };
}
