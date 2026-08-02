import { describe, expect, it } from 'vitest';

import {
  OperatorFilePathRefusedError,
  assertOperatorFilePathOutsideRepository,
} from '../operator-file-path-policy';

/**
 * ADR-0054 D2, applied again by D3 — an operator-authored file carrying real
 * client data lives OUTSIDE the repository and is never committed.
 *
 * ⚠️ `.gitignore` is NOT the control. The control is that a path inside the
 * working tree is REFUSED, not warned about and not ignored.
 *
 * ⚠️ A relative path is refused outright: resolving one would read `cwd`, which
 * is both an impurity and exactly the "search of the working directory" D2
 * forbids. There is no default path and no fallback location.
 */

const REPO = '/home/operator/AGE';
const SUBJECT = 'answer file';

function assertPath(candidate: string, root: string = REPO, subject: string = SUBJECT): void {
  assertOperatorFilePathOutsideRepository(candidate, root, subject);
}

describe('assertOperatorFilePathOutsideRepository', () => {
  it('accepts a path fully outside the repository', () => {
    expect(() => assertPath('/home/operator/age-private/answers.json')).not.toThrow();
  });

  it('accepts a sibling directory whose name merely prefixes the repo path', () => {
    // `/home/operator/AGE-notes` is NOT inside `/home/operator/AGE`; a naive
    // startsWith check would wrongly refuse it.
    expect(() => assertPath('/home/operator/AGE-notes/answers.json')).not.toThrow();
  });

  it('refuses a path directly inside the repository', () => {
    expect(() => assertPath(`${REPO}/answers.json`)).toThrow(OperatorFilePathRefusedError);
  });

  it('refuses a path nested deep inside the repository', () => {
    expect(() => assertPath(`${REPO}/packages/foo/answers.json`)).toThrow(
      OperatorFilePathRefusedError,
    );
  });

  it('refuses the repository root itself', () => {
    expect(() => assertPath(REPO)).toThrow(OperatorFilePathRefusedError);
  });

  it('refuses a path that escapes back into the repository via ..', () => {
    expect(() => assertPath('/home/operator/AGE/../AGE/answers.json')).toThrow(
      OperatorFilePathRefusedError,
    );
  });

  it('refuses a relative path rather than resolving it against cwd', () => {
    expect(() => assertPath('answers.json')).toThrow(OperatorFilePathRefusedError);
    expect(() => assertPath('../answers.json')).toThrow(OperatorFilePathRefusedError);
  });

  it('refuses an empty or blank path', () => {
    expect(() => assertPath('')).toThrow(OperatorFilePathRefusedError);
    expect(() => assertPath('   ')).toThrow(OperatorFilePathRefusedError);
  });

  it('requires the repository root to be absolute too', () => {
    expect(() => assertPath('/home/operator/answers.json', 'AGE')).toThrow(
      OperatorFilePathRefusedError,
    );
  });

  describe('Windows-style paths', () => {
    const WIN_REPO = 'E:\\ai-powered-crm-projects\\AGE';

    it('accepts a path outside the repository', () => {
      expect(() => assertPath('E:\\age-private\\answers.json', WIN_REPO)).not.toThrow();
    });

    it('refuses a path inside the repository', () => {
      expect(() => assertPath(`${WIN_REPO}\\answers.json`, WIN_REPO)).toThrow(
        OperatorFilePathRefusedError,
      );
    });

    it('refuses regardless of case, because Windows paths are case-insensitive', () => {
      // Fail-closed: comparing case-insensitively refuses MORE, never fewer.
      expect(() => assertPath('e:\\AI-POWERED-CRM-PROJECTS\\age\\answers.json', WIN_REPO)).toThrow(
        OperatorFilePathRefusedError,
      );
    });

    it('refuses when separators are mixed', () => {
      expect(() => assertPath('E:/ai-powered-crm-projects/AGE/a.json', WIN_REPO)).toThrow(
        OperatorFilePathRefusedError,
      );
    });
  });

  it('names the repository in the refusal so the operator can see why', () => {
    expect(() => assertPath(`${REPO}/answers.json`)).toThrow(/inside the repository working tree/i);
  });

  it('does not mention .gitignore as a remedy', () => {
    // ⚠️ ADR-0054 D2: ".gitignore is not the control." Suggesting it would
    // teach the operator the wrong fix.
    let message = '';
    try {
      assertPath(`${REPO}/answers.json`);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toMatch(/gitignore/i);
  });

  describe('the subject', () => {
    it('names the refused file, so two callers cannot describe each other', () => {
      // ⚠️ D3 puts a SECOND kind of file behind this same rule. A refusal that
      // said only "the file" would leave the operator guessing which of the two
      // paths was rejected.
      expect(() => assertPath(`${REPO}/records.json`, REPO, 'client record file')).toThrow(
        /client record file/,
      );
      expect(() => assertPath('records.json', REPO, 'client record file')).toThrow(
        /client record file/,
      );
      expect(() => assertPath('', REPO, 'client record file')).toThrow(/client record file/);
    });

    it('is itself required — a blank subject is refused, never defaulted', () => {
      expect(() => assertPath('/home/operator/x.json', REPO, '  ')).toThrow(
        OperatorFilePathRefusedError,
      );
    });

    it('carries the subject and the candidate on the error for the caller', () => {
      try {
        assertPath(`${REPO}/records.json`, REPO, 'client record file');
        expect.unreachable('the path should have been refused');
      } catch (error) {
        expect(error).toBeInstanceOf(OperatorFilePathRefusedError);
        expect((error as OperatorFilePathRefusedError).subject).toBe('client record file');
        expect((error as OperatorFilePathRefusedError).candidatePath).toBe(`${REPO}/records.json`);
      }
    });
  });
});
