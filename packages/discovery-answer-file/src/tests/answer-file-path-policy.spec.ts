import { describe, expect, it } from 'vitest';

import {
  AnswerFilePathRefusedError,
  assertAnswerFilePathOutsideRepository,
} from '../answer-file-path-policy';

/**
 * ADR-0054 D2 — the answer file lives OUTSIDE the repository and is never
 * committed.
 *
 * ⚠️ `.gitignore` is NOT the control. The control is that a path inside the
 * working tree is REFUSED, not warned about and not ignored.
 *
 * ⚠️ A relative path is refused outright: resolving one would read `cwd`, which
 * is both an impurity and exactly the "search of the working directory" D2
 * forbids. There is no default path and no fallback location.
 */

const REPO = '/home/operator/AGE';

describe('assertAnswerFilePathOutsideRepository', () => {
  it('accepts a path fully outside the repository', () => {
    expect(() =>
      assertAnswerFilePathOutsideRepository('/home/operator/age-private/answers.json', REPO),
    ).not.toThrow();
  });

  it('accepts a sibling directory whose name merely prefixes the repo path', () => {
    // `/home/operator/AGE-notes` is NOT inside `/home/operator/AGE`; a naive
    // startsWith check would wrongly refuse it.
    expect(() =>
      assertAnswerFilePathOutsideRepository('/home/operator/AGE-notes/answers.json', REPO),
    ).not.toThrow();
  });

  it('refuses a path directly inside the repository', () => {
    expect(() => assertAnswerFilePathOutsideRepository(`${REPO}/answers.json`, REPO)).toThrow(
      AnswerFilePathRefusedError,
    );
  });

  it('refuses a path nested deep inside the repository', () => {
    expect(() =>
      assertAnswerFilePathOutsideRepository(`${REPO}/packages/foo/answers.json`, REPO),
    ).toThrow(AnswerFilePathRefusedError);
  });

  it('refuses the repository root itself', () => {
    expect(() => assertAnswerFilePathOutsideRepository(REPO, REPO)).toThrow(
      AnswerFilePathRefusedError,
    );
  });

  it('refuses a path that escapes back into the repository via ..', () => {
    expect(() =>
      assertAnswerFilePathOutsideRepository('/home/operator/AGE/../AGE/answers.json', REPO),
    ).toThrow(AnswerFilePathRefusedError);
  });

  it('refuses a relative path rather than resolving it against cwd', () => {
    expect(() => assertAnswerFilePathOutsideRepository('answers.json', REPO)).toThrow(
      AnswerFilePathRefusedError,
    );
    expect(() => assertAnswerFilePathOutsideRepository('../answers.json', REPO)).toThrow(
      AnswerFilePathRefusedError,
    );
  });

  it('refuses an empty or blank path', () => {
    expect(() => assertAnswerFilePathOutsideRepository('', REPO)).toThrow(
      AnswerFilePathRefusedError,
    );
    expect(() => assertAnswerFilePathOutsideRepository('   ', REPO)).toThrow(
      AnswerFilePathRefusedError,
    );
  });

  it('requires the repository root to be absolute too', () => {
    expect(() =>
      assertAnswerFilePathOutsideRepository('/home/operator/answers.json', 'AGE'),
    ).toThrow(AnswerFilePathRefusedError);
  });

  describe('Windows-style paths', () => {
    const WIN_REPO = 'E:\\ai-powered-crm-projects\\AGE';

    it('accepts a path outside the repository', () => {
      expect(() =>
        assertAnswerFilePathOutsideRepository('E:\\age-private\\answers.json', WIN_REPO),
      ).not.toThrow();
    });

    it('refuses a path inside the repository', () => {
      expect(() =>
        assertAnswerFilePathOutsideRepository(`${WIN_REPO}\\answers.json`, WIN_REPO),
      ).toThrow(AnswerFilePathRefusedError);
    });

    it('refuses regardless of case, because Windows paths are case-insensitive', () => {
      // Fail-closed: comparing case-insensitively refuses MORE, never fewer.
      expect(() =>
        assertAnswerFilePathOutsideRepository(
          'e:\\AI-POWERED-CRM-PROJECTS\\age\\answers.json',
          WIN_REPO,
        ),
      ).toThrow(AnswerFilePathRefusedError);
    });

    it('refuses when separators are mixed', () => {
      expect(() =>
        assertAnswerFilePathOutsideRepository('E:/ai-powered-crm-projects/AGE/a.json', WIN_REPO),
      ).toThrow(AnswerFilePathRefusedError);
    });
  });

  it('names the repository in the refusal so the operator can see why', () => {
    expect(() => assertAnswerFilePathOutsideRepository(`${REPO}/answers.json`, REPO)).toThrow(
      /inside the repository working tree/i,
    );
  });

  it('does not mention .gitignore as a remedy', () => {
    // ⚠️ ADR-0054 D2: ".gitignore is not the control." Suggesting it would
    // teach the operator the wrong fix.
    let message = '';
    try {
      assertAnswerFilePathOutsideRepository(`${REPO}/answers.json`, REPO);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toMatch(/gitignore/i);
  });
});
