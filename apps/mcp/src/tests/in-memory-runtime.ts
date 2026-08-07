import { resolve } from 'node:path';

import type { OperatorWorkspaceRuntime } from '@age/operator-workspace';

/**
 * A runtime backed by a `Map`, for this app's specs.
 *
 * ⚠️ A NEAR-COPY OF `@age/operator-workspace`'s own test runtime, DELIBERATELY,
 * and the duplication rule does not apply to it: that one is not exported (a
 * guard in that package asserts it), because a surface wired to a fake
 * filesystem would answer "nothing here" to every question — indistinguishable
 * on screen from a business AGE looked at and found empty. Importing it here
 * would mean exporting it there, so this app builds its own.
 *
 * 🚫 It is never reachable from `src/main.ts`; an effect-isolation guard asserts
 * that the only module in this app holding a real effect is `main.ts`.
 */
export interface InMemoryRuntime extends OperatorWorkspaceRuntime {
  readonly files: Map<string, string>;
  readonly calls: string[];
}

/** A tree the operator's files are deliberately OUTSIDE of (ADR-0054 D2). */
export const FIXTURE_REPOSITORY_ROOT = resolve('/fixture-repository');

/** 🚫 Obviously fictional, by rule (ADR-0053 D3). */
export const FIXTURE_OPERATOR_DIRECTORY = resolve('/fixture-operator');

export function createInMemoryRuntime(
  env: Readonly<Record<string, string | undefined>> = {},
): InMemoryRuntime {
  const files = new Map<string, string>();
  const calls: string[] = [];

  return {
    files,
    calls,
    env,
    repositoryRoot: () => FIXTURE_REPOSITORY_ROOT,
    now: () => new Date('2026-01-01T00:00:00.000Z'),
    fileExists: (path) => {
      calls.push(`fileExists:${path}`);
      return files.has(path);
    },
    readFileText: (path) => {
      calls.push(`readFileText:${path}`);
      const contents = files.get(path);
      if (contents === undefined) {
        throw new Error('ENOENT: no such file or directory');
      }
      return contents;
    },
    writeFileText: (path, contents) => {
      calls.push(`writeFileText:${path}`);
      files.set(path, contents);
    },
    ensureDirectory: (path) => {
      calls.push(`ensureDirectory:${path}`);
    },
  };
}
