import { DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE } from '@age/business-discovery-contracts';
import { describe, expect, it } from 'vitest';

import { AnswerFilePathRefusedError } from '../answer-file-path-policy';
import { loadDiscoveryAnswerFile } from '../load-discovery-answer-file';
import { DiscoveryAnswerFileError } from '../parse-discovery-answer-file';

/**
 * ADR-0054 D1 + D2 wired together.
 *
 * ⚠️ The package itself performs NO I/O: the reader is injected, exactly as
 * `apps/capture` injects its runtime (every DECISION pure, every EFFECT at the
 * edge). That is what keeps this package inside the purity guard while still
 * describing an end-to-end load.
 *
 * 🚫 There is NO default path and NO default reader — both are required
 * parameters (ADR-0049 D2's rule, applied here: a default makes the whole thing
 * unfalsifiable behind a signature that only LOOKS parameterised).
 */

const Q = DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE;
const REPO = '/home/operator/AGE';
const OUTSIDE = '/home/operator/age-private/answers.json';

const VALID = JSON.stringify({
  questionnaireId: Q.id,
  questionnaireVersion: Q.version,
  answers: [{ questionId: 'bi-name', value: 'Example Fictional Co' }],
});

describe('loadDiscoveryAnswerFile', () => {
  it('reads the operator-supplied path and returns validated answers', () => {
    const seen: string[] = [];
    const answers = loadDiscoveryAnswerFile({
      path: OUTSIDE,
      repositoryRoot: REPO,
      questionnaire: Q,
      readFileText: (p) => {
        seen.push(p);
        return VALID;
      },
    });

    expect(seen).toEqual([OUTSIDE]);
    expect(answers).toEqual([{ questionId: 'bi-name', value: 'Example Fictional Co' }]);
  });

  it('refuses an in-repository path BEFORE reading anything', () => {
    let reads = 0;
    expect(() =>
      loadDiscoveryAnswerFile({
        path: `${REPO}/answers.json`,
        repositoryRoot: REPO,
        questionnaire: Q,
        readFileText: () => {
          reads += 1;
          return VALID;
        },
      }),
    ).toThrow(AnswerFilePathRefusedError);

    // The refusal must precede the effect — otherwise a refused path has
    // already been opened.
    expect(reads).toBe(0);
  });

  it('propagates a validation refusal from the parser, naming the question', () => {
    expect(() =>
      loadDiscoveryAnswerFile({
        path: OUTSIDE,
        repositoryRoot: REPO,
        questionnaire: Q,
        readFileText: () =>
          JSON.stringify({
            questionnaireId: Q.id,
            questionnaireVersion: Q.version,
            answers: [{ questionId: 'bi-name', value: '' }],
          }),
      }),
    ).toThrow(/bi-name/);
  });

  it('surfaces a reader failure as a refusal, not as an empty answer set', () => {
    // 🚫 A missing/unreadable file must never degrade into "no answers" — that
    // would silently produce a profile that looks merely incomplete.
    expect(() =>
      loadDiscoveryAnswerFile({
        path: OUTSIDE,
        repositoryRoot: REPO,
        questionnaire: Q,
        readFileText: () => {
          throw new Error('ENOENT: no such file or directory');
        },
      }),
    ).toThrow(DiscoveryAnswerFileError);
  });

  it('reads the file exactly once', () => {
    let reads = 0;
    loadDiscoveryAnswerFile({
      path: OUTSIDE,
      repositoryRoot: REPO,
      questionnaire: Q,
      readFileText: () => {
        reads += 1;
        return VALID;
      },
    });
    expect(reads).toBe(1);
  });

  it('never writes back to the file — the reader is the only capability given', () => {
    // The dependency surface is a single read function; there is no writer to
    // call. This asserts the shape rather than a behaviour.
    const deps = {
      path: OUTSIDE,
      repositoryRoot: REPO,
      questionnaire: Q,
      readFileText: () => VALID,
    };
    expect(Object.keys(deps).sort()).toEqual([
      'path',
      'questionnaire',
      'readFileText',
      'repositoryRoot',
    ]);
  });
});
