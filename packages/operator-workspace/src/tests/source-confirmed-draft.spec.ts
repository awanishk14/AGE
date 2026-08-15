import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { SourceDocument, SourcePassage } from '@age/assisted-intake';

import {
  createClientRecord,
  generateBifFromAnswerFile,
  submitDiscoveryAnswers,
  STUDIO_QUESTIONNAIRE,
} from '../operator-workspace';
import { readSourceConfirmations, recordSourceConfirmation } from '../source-confirmed-draft';
import {
  createInMemoryRuntime,
  FIXTURE_OPERATOR_DIRECTORY,
  type InMemoryRuntime,
} from './in-memory-runtime';

/**
 * ADR-0073 — the confirmations a human accepted from a source, kept where the
 * next request can find them.
 *
 * 🛑 **THE DEFECT THIS SPEC EXISTS TO PIN.** Before ADR-0073 each acceptance was
 * recorded into an empty draft and thrown away with the request, so an operator
 * reading a document with several answers in it lost every confirmation but the
 * last. ⚠️ The Product Owner fired ADR-0067's own named revisit trigger — a real
 * operator, a real document — which is why this is a reopening and 🚫 not a
 * decision taken around one.
 *
 * 🚫 No fixture here names a real client, and 🚫 no passage is a real business's
 * words — obvious fictionality is the guard (ADR-0053 D3, ADR-0065 D1).
 */

const RECORD_FILE = join(FIXTURE_OPERATOR_DIRECTORY, 'clients.json');
const WORKSPACE = join(FIXTURE_OPERATOR_DIRECTORY, 'discovery');

const CONFIGURED = Object.freeze({
  AGE_CLIENT_RECORD_FILE: RECORD_FILE,
  AGE_DISCOVERY_WORKSPACE: WORKSPACE,
});

const CLIENT = Object.freeze({
  clientId: 'fictional-client-73',
  organizationId: 'org-fictional-73',
  displayName: 'A Fictional Cooperative',
  externalRefsText: '',
});

const SOURCE: SourceDocument = {
  sourceId: 'src-fictional-brief',
  label: 'Fictional Brief',
  kind: 'plain-text',
  locator: 'E:/fictional-operator-files/brief.txt',
  text: 'Imaginary sentence number 1 from a document nobody real wrote.',
};

const CONFIRMED_BY = 'operator:fictional';

/**
 * ⚠️ Required, scalar-valued questions — a passage is one span of prose, so a
 * list question is a different acceptance and 🚫 the kind is read off the
 * QUESTION, never inferred from the value (ADR-0051).
 */
const TEXT_QUESTIONS = STUDIO_QUESTIONNAIRE.sections
  .flatMap((section) => section.questions)
  .filter(
    (question) => question.required && (question.kind === 'text' || question.kind === 'longText'),
  );

const [FIRST_QUESTION, SECOND_QUESTION, THIRD_QUESTION] = TEXT_QUESTIONS;
if (FIRST_QUESTION === undefined || SECOND_QUESTION === undefined || THIRD_QUESTION === undefined) {
  throw new Error('The questionnaire has fewer than three required scalar questions.');
}

/** A scalar question the answer file leaves unanswered, so the channels stay apart. */
const OPTIONAL_QUESTION = STUDIO_QUESTIONNAIRE.sections
  .flatMap((section) => section.questions)
  .find(
    (question) => !question.required && (question.kind === 'text' || question.kind === 'longText'),
  );
if (OPTIONAL_QUESTION === undefined) {
  throw new Error('The questionnaire has no optional scalar question.');
}

function passage(index: number): SourcePassage {
  return {
    passageId: `${SOURCE.sourceId}#${index}`,
    text: `Imaginary sentence number ${index} from a document nobody real wrote.`,
    locator: `line ${index}`,
  };
}

function configuredRuntime(): InMemoryRuntime {
  const runtime = createInMemoryRuntime(CONFIGURED);
  createClientRecord(runtime, CLIENT);
  return runtime;
}

describe('a business nobody has read a document for', () => {
  /**
   * ⚠️ "Nobody has confirmed anything yet" is told apart from "we could not
   * look" — `everSaved` exists so a screen cannot render the second as the
   * first.
   */
  it('reports an empty draft that was never saved, not a failure', () => {
    const outcome = readSourceConfirmations(configuredRuntime(), CLIENT.clientId);

    expect(outcome.kind).toBe('loaded');
    if (outcome.kind !== 'loaded') return;
    expect(outcome.draft.answers).toHaveLength(0);
    expect(outcome.everSaved).toBe(false);
  });

  it('says the workspace is not configured rather than showing nothing', () => {
    const runtime = createInMemoryRuntime({ AGE_CLIENT_RECORD_FILE: RECORD_FILE });
    const outcome = readSourceConfirmations(runtime, CLIENT.clientId);

    expect(outcome.kind).toBe('not-configured');
    if (outcome.kind !== 'not-configured') return;
    expect(outcome.variable).toBe('AGE_DISCOVERY_WORKSPACE');
  });
});

describe('an operator confirming several answers from one document', () => {
  /**
   * 🛑 **THE WHOLE POINT.** Three confirmations, three separate calls — as three
   * separate requests would be — and all three are still there at the end.
   */
  it('keeps every earlier confirmation', () => {
    const runtime = configuredRuntime();

    for (const [index, question] of [FIRST_QUESTION, SECOND_QUESTION, THIRD_QUESTION].entries()) {
      const outcome = recordSourceConfirmation(runtime, CLIENT.clientId, {
        questionId: question.id,
        passage: passage(index + 1),
        source: SOURCE,
        confirmedBy: CONFIRMED_BY,
      });

      expect(outcome.kind, JSON.stringify(outcome)).toBe('recorded');
      if (outcome.kind !== 'recorded') return;
      expect(outcome.draft.answers).toHaveLength(index + 1);
      // ⚠️ Widened only by the layer that completed the write (ADR-0073 D7).
      expect(outcome.storage).toBe('workspace-file');
    }

    const reread = readSourceConfirmations(runtime, CLIENT.clientId);
    expect(reread.kind).toBe('loaded');
    if (reread.kind !== 'loaded') return;
    expect(reread.draft.answers).toHaveLength(3);
    expect(reread.everSaved).toBe(true);
    // 🚫 Every recorded answer keeps its own origin — no default put it there.
    expect(
      reread.draft.answers.every((answer) => answer.provenance.kind === 'confirmed-from-source'),
    ).toBe(true);
  });

  /**
   * 🚫 **A DUPLICATE IS REFUSED, NEVER OVERWRITTEN**, and the refusal is real
   * across requests only because the recording reads what is on DISK first
   * (ADR-0073 D4).
   */
  it('🚫 REFUSES a second answer to the same question and leaves the first standing', () => {
    const runtime = configuredRuntime();

    const first = recordSourceConfirmation(runtime, CLIENT.clientId, {
      questionId: FIRST_QUESTION.id,
      passage: passage(1),
      source: SOURCE,
      confirmedBy: CONFIRMED_BY,
    });
    expect(first.kind).toBe('recorded');

    const second = recordSourceConfirmation(runtime, CLIENT.clientId, {
      questionId: FIRST_QUESTION.id,
      passage: passage(2),
      source: SOURCE,
      confirmedBy: CONFIRMED_BY,
    });
    expect(second.kind).toBe('refused');

    const reread = readSourceConfirmations(runtime, CLIENT.clientId);
    if (reread.kind !== 'loaded') throw new Error('expected the confirmations to load');
    expect(reread.draft.answers).toHaveLength(1);
    expect(reread.draft.answers[0]?.value).toBe(passage(1).text);
  });

  /**
   * 🛑 **A FAILED WRITE IS REPORTED AS A REFUSAL, 🚫 NEVER SWALLOWED AND NEVER
   * REPORTED AS RECORDED** (ADR-0073 D7). An operator who believes a
   * confirmation is durable when it is not loses work without ever being told.
   */
  it('🛑 REFUSES when the write fails, and says nothing was recorded', () => {
    const runtime = configuredRuntime();
    const failing: typeof runtime = {
      ...runtime,
      writeFileText: () => {
        throw new Error(`EACCES: permission denied, open '${WORKSPACE}/secret-layout.json'`);
      },
    };

    const outcome = recordSourceConfirmation(failing, CLIENT.clientId, {
      questionId: FIRST_QUESTION.id,
      passage: passage(1),
      source: SOURCE,
      confirmedBy: CONFIRMED_BY,
    });

    expect(outcome.kind).toBe('refused');
    if (outcome.kind !== 'refused') return;
    expect(outcome.reason).toContain('NOT');
    // 🚫 The message names a position, never the operator's directory layout.
    expect(outcome.reason).not.toContain(WORKSPACE);
    expect(outcome.reason).not.toContain('EACCES');
  });

  /**
   * 🚫 A file that exists and cannot be parsed REFUSES. Starting over would let
   * the next confirmation be written on top of work still visible in that file.
   */
  it('🚫 REFUSES an unreadable file rather than starting from an empty draft', () => {
    const runtime = configuredRuntime();
    runtime.files.set(
      join(WORKSPACE, `${CLIENT.clientId}.source-confirmed.json`),
      '{ this is not json',
    );

    const read = readSourceConfirmations(runtime, CLIENT.clientId);
    expect(read.kind).toBe('refused');

    const record = recordSourceConfirmation(runtime, CLIENT.clientId, {
      questionId: FIRST_QUESTION.id,
      passage: passage(1),
      source: SOURCE,
      confirmedBy: CONFIRMED_BY,
    });
    expect(record.kind).toBe('refused');
  });

  /** 🚫 The answer file is a SEPARATE channel and is never touched (D2). */
  it('🚫 writes only its own file — the answer file is untouched', () => {
    const runtime = configuredRuntime();
    recordSourceConfirmation(runtime, CLIENT.clientId, {
      questionId: FIRST_QUESTION.id,
      passage: passage(1),
      source: SOURCE,
      confirmedBy: CONFIRMED_BY,
    });

    expect(runtime.files.has(join(WORKSPACE, `${CLIENT.clientId}.source-confirmed.json`))).toBe(
      true,
    );
    expect(runtime.files.has(join(WORKSPACE, `${CLIENT.clientId}.discovery-answers.json`))).toBe(
      false,
    );
  });
});

describe('a BIF produced from both intake channels', () => {
  function answeredDraft() {
    const answers: Record<string, string | readonly string[]> = {};

    for (const section of STUDIO_QUESTIONNAIRE.sections) {
      for (const question of section.questions) {
        if (!question.required) continue;
        if (question.kind === 'list') {
          answers[question.id] = ['A fictional item'];
        } else if (question.kind === 'choice') {
          const [first] = question.choices ?? [];
          if (first !== undefined) answers[question.id] = first;
        } else {
          answers[question.id] = 'A fictional answer.';
        }
      }
    }

    return {
      questionnaireId: STUDIO_QUESTIONNAIRE.id,
      questionnaireVersion: STUDIO_QUESTIONNAIRE.version,
      answers,
      // 🚫 An unanswered question is OMITTED, never filled in.
      skips: {},
    };
  }

  /**
   * ⚠️ Both channels reach the profile through the SAME explicit path, and the
   * origin channel keeps them apart: a confirmed answer reads
   * `confirmed-from-source`, a typed one reads `stated`. 🚫 Neither is defaulted
   * and 🚫 they are never merged.
   */
  it('carries a confirmed answer into the BIF, still labelled as confirmed', () => {
    const runtime = configuredRuntime();

    const submitted = submitDiscoveryAnswers(runtime, CLIENT.clientId, answeredDraft());
    expect(submitted.kind, JSON.stringify(submitted)).toBe('written');

    // ⚠️ A question the answer file does NOT answer — the two channels stay two.
    const recorded = recordSourceConfirmation(runtime, CLIENT.clientId, {
      questionId: OPTIONAL_QUESTION.id,
      passage: passage(1),
      source: SOURCE,
      confirmedBy: CONFIRMED_BY,
    });
    expect(recorded.kind, JSON.stringify(recorded)).toBe('recorded');

    const outcome = generateBifFromAnswerFile(runtime, CLIENT.clientId, CONFIRMED_BY);
    expect(outcome.kind, JSON.stringify(outcome)).toBe('generated');
    if (outcome.kind !== 'generated') return;

    const origins = outcome.fieldSources.flatMap((section) =>
      section.fields.flatMap((field) => field.origins),
    );
    expect(origins.some((origin) => origin.kind === 'confirmed-from-source')).toBe(true);
    expect(origins.some((origin) => origin.kind === 'stated')).toBe(true);
  });

  /**
   * 🛑 **THE TWO ANSWERS ARE NEVER MERGED, AND NEITHER WINS** (ADR-0073 D5).
   * Choosing one would discard an answer somebody gave; the operator resolves it
   * by removing one, which is a decision only they can make.
   */
  it('🛑 REFUSES a question answered in BOTH channels rather than choosing one', () => {
    const runtime = configuredRuntime();

    // ⚠️ The answer file answers everything, including the question below.
    const submitted = submitDiscoveryAnswers(runtime, CLIENT.clientId, answeredDraft());
    expect(submitted.kind, JSON.stringify(submitted)).toBe('written');

    const recorded = recordSourceConfirmation(runtime, CLIENT.clientId, {
      questionId: FIRST_QUESTION.id,
      passage: passage(1),
      source: SOURCE,
      confirmedBy: CONFIRMED_BY,
    });
    expect(recorded.kind, JSON.stringify(recorded)).toBe('recorded');

    const outcome = generateBifFromAnswerFile(runtime, CLIENT.clientId, CONFIRMED_BY);
    expect(outcome.kind).toBe('refused');
    if (outcome.kind !== 'refused') return;
    expect(outcome.reason).toContain(FIRST_QUESTION.id);
    expect(outcome.reason).toContain('refuses');
  });

  /**
   * ⚠️ Confirmations alone are a real intake. 🚫 Refusing to produce from them
   * would tell an operator who has done work that nothing exists — and the BIF
   * that results simply OMITS the sections it has no answers for.
   */
  it('produces from confirmations alone when there is no answer file', () => {
    const runtime = configuredRuntime();

    const recorded = recordSourceConfirmation(runtime, CLIENT.clientId, {
      questionId: FIRST_QUESTION.id,
      passage: passage(1),
      source: SOURCE,
      confirmedBy: CONFIRMED_BY,
    });
    expect(recorded.kind, JSON.stringify(recorded)).toBe('recorded');

    const outcome = generateBifFromAnswerFile(runtime, CLIENT.clientId, CONFIRMED_BY);
    expect(outcome.kind, JSON.stringify(outcome)).toBe('generated');
  });

  /** ⚠️ And with NEITHER channel it is still "not submitted", not an empty BIF. */
  it('still reports no answer file when neither channel holds anything', () => {
    const outcome = generateBifFromAnswerFile(configuredRuntime(), CLIENT.clientId, CONFIRMED_BY);
    expect(outcome.kind).toBe('no-answer-file');
  });
});
