import type {
  BusinessDiscoveryQuestionnaire,
  DiscoveryAnswer,
} from '@age/business-discovery-contracts';
import { assertOperatorFilePathOutsideRepository } from '@age/operator-file-policy';

import { DiscoveryAnswerFileError, parseDiscoveryAnswerFile } from './parse-discovery-answer-file';

/**
 * ADR-0054 D1 + D2, wired together — the path policy runs BEFORE anything is
 * read, then the file's text is validated against the questionnaire.
 *
 * ⚠️ This package performs NO I/O. The read is INJECTED, exactly as
 * `apps/capture` injects its runtime: every DECISION here is pure, and the
 * single EFFECT lives at the caller's edge. That is what keeps the package
 * inside its own purity guard while still describing an end-to-end load.
 *
 * 🚫 There is no default path and no default reader. A default would make the
 * whole thing unfalsifiable behind a signature that only LOOKS parameterised
 * (ADR-0049 D2's rule, applied here).
 *
 * 🚫 The only capability handed in is a READER. There is no writer to call, so
 * the answer file cannot be modified by this code path.
 */

/** Reads a file's text. Injected — this package never touches the filesystem. */
export type AnswerFileReader = (path: string) => string;

export interface LoadDiscoveryAnswerFileOptions {
  /** Absolute path to the operator-authored file. Required, no default. */
  readonly path: string;
  /** Absolute path to the repository working tree the file must live outside. */
  readonly repositoryRoot: string;
  /** The questionnaire the answers are validated against. Required, no default. */
  readonly questionnaire: BusinessDiscoveryQuestionnaire;
  /** The injected read effect. Required, no default. */
  readonly readFileText: AnswerFileReader;
}

/**
 * Loads and validates an operator-authored answer file.
 *
 * @throws {OperatorFilePathRefusedError} if the path is blank, relative, or
 *         inside the repository working tree — raised before any read.
 * @throws {DiscoveryAnswerFileError} if the file cannot be read, or if its
 *         contents fail validation (naming the offending question id).
 */
export function loadDiscoveryAnswerFile(
  options: LoadDiscoveryAnswerFileOptions,
): readonly DiscoveryAnswer[] {
  const { path, repositoryRoot, questionnaire, readFileText } = options;

  // Order is load-bearing: a refused path must never be opened.
  assertOperatorFilePathOutsideRepository(path, repositoryRoot, 'answer file');

  let rawText: string;
  try {
    rawText = readFileText(path);
  } catch (error) {
    // 🚫 A missing or unreadable file is a REFUSAL, never an empty answer set.
    // Degrading to "no answers" would produce a profile that merely looks
    // incomplete, hiding the fact that nothing was read at all.
    throw new DiscoveryAnswerFileError(
      `The answer file could not be read: ${(error as Error).message}`,
    );
  }

  return parseDiscoveryAnswerFile(rawText, questionnaire);
}
