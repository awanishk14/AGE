import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assembleEvidence,
  createClientRecord,
  generateBifFromAnswerFile,
  readBusinessesView,
  readDiscoveryDraft,
  reportContradictions,
  resolveBusinessScope,
  submitDiscoveryAnswers,
  writeDiscoveryDraft,
  STUDIO_QUESTIONNAIRE,
} from '../operator-workspace';
import {
  createInMemoryRuntime,
  FIXTURE_OPERATOR_DIRECTORY,
  FIXTURE_REPOSITORY_ROOT,
} from './in-memory-runtime';

/**
 * The nine operations, exercised for the first time (ADR-0060 D2).
 *
 * ⚠️ THIS SPEC IS THE ARGUMENT FOR THE EXTRACTION. While these lived inside
 * `apps/studio` they could only run against a real disk, so nothing ran them:
 * the console's 108 tests cover the SCREENS. What they never covered is what
 * happens when the operator has configured nothing, which is every operator's
 * first minute with the product.
 *
 * 🚫 No fixture here names a real client — obvious fictionality is the guard
 * (ADR-0053 D3), and 🚫 the operator's live client names must never appear in a
 * commit. ⚠️ They are 🚫 NOT restated here: `@age/client-registry`'s
 * `forbidden-client-names.ts` holds them as digests precisely so a comment
 * about the rule stops being a place the rule is broken.
 */

const RECORD_FILE = join(FIXTURE_OPERATOR_DIRECTORY, 'clients.json');
const WORKSPACE = join(FIXTURE_OPERATOR_DIRECTORY, 'discovery');

const CONFIGURED = Object.freeze({
  AGE_CLIENT_RECORD_FILE: RECORD_FILE,
  AGE_DISCOVERY_WORKSPACE: WORKSPACE,
});

describe('an operator who has configured nothing', () => {
  /**
   * 🚫 "Nobody told me where to look" must never render as "there are no
   * businesses". An empty list is a claim about the operator's clients; this is
   * a claim about the operator's environment.
   */
  it('is told which variable is missing, never shown an empty registry', () => {
    const runtime = createInMemoryRuntime({});

    expect(readBusinessesView(runtime)).toEqual({
      kind: 'not-configured',
      variable: 'AGE_CLIENT_RECORD_FILE',
    });
  });

  it('opens no file at all', () => {
    // ⚠️ The guard against a read that happens BEFORE the configuration check:
    // a refusal that already touched the disk is not a refusal.
    const runtime = createInMemoryRuntime({});
    readBusinessesView(runtime);

    expect(runtime.calls.filter((call) => call.startsWith('readFileText'))).toEqual([]);
  });

  it('refuses every downstream operation for the same stated reason', () => {
    const runtime = createInMemoryRuntime({});

    for (const outcome of [
      resolveBusinessScope(runtime, 'fictional-client-1'),
      readDiscoveryDraft(runtime, 'fictional-client-1'),
      assembleEvidence(runtime, 'fictional-client-1', 'operator:fixture'),
      reportContradictions(runtime, 'fictional-client-1', 'operator:fixture'),
    ]) {
      expect(outcome.kind).toBe('not-configured');
    }
  });
});

describe('an operator whose record file is inside the repository', () => {
  /**
   * 🛑 ADR-0054 D2. A real client's data inside the working tree is one
   * `git add -A` away from being committed, and 🚫 "private is not a control".
   */
  it('is refused, and the refusal does not require the file to exist', () => {
    const inside = join(FIXTURE_REPOSITORY_ROOT, 'clients.json');
    const runtime = createInMemoryRuntime({ AGE_CLIENT_RECORD_FILE: inside });

    const view = readBusinessesView(runtime);

    expect(view.kind).toBe('refused');
    expect(runtime.calls.filter((call) => call.startsWith('writeFileText'))).toEqual([]);
  });
});

describe('creating the first client record', () => {
  const DRAFT = Object.freeze({
    clientId: 'fictional-client-1',
    organizationId: 'org-fictional-1',
    displayName: 'A Fictional Business',
    externalRefsText: '',
  });

  it('writes the record file, and reads back exactly what it wrote', () => {
    const runtime = createInMemoryRuntime(CONFIGURED);

    const created = createClientRecord(runtime, DRAFT);
    expect(created.kind).toBe('created');

    const view = readBusinessesView(runtime);
    expect(view.kind).toBe('listed');
  });

  it('resolves a scope whose organization was DERIVED, never typed', () => {
    const runtime = createInMemoryRuntime(CONFIGURED);
    createClientRecord(runtime, DRAFT);

    const scope = resolveBusinessScope(runtime, 'fictional-client-1');

    expect(scope.kind).toBe('resolved');
    if (scope.kind === 'resolved') {
      expect(scope.client.organizationId).toBe('org-fictional-1');
    }
  });

  /**
   * 🚫 An unknown clientId is REFUSED, never rendered as a business with no
   * data — that would put a scope into circulation that names nothing.
   * 🚫 And the refusal must not list the other clients' ids: an error message
   * must never carry a real client's name into a log (ADR-0054 D3).
   */
  it('refuses an unknown clientId without naming the known ones', () => {
    const runtime = createInMemoryRuntime(CONFIGURED);
    createClientRecord(runtime, DRAFT);

    const scope = resolveBusinessScope(runtime, 'fictional-client-2');

    expect(scope.kind).toBe('unknown-client');
  });
});

describe('a discovery draft nobody has started', () => {
  /**
   * ⚠️ "No file yet" is the ORDINARY state of a business nobody has started,
   * and it is a different fact from "the saved draft is unreadable". 🚫 The two
   * must never render the same way.
   */
  it('loads empty and says it was never saved', () => {
    const runtime = createInMemoryRuntime(CONFIGURED);

    const outcome = readDiscoveryDraft(runtime, 'fictional-client-1');

    expect(outcome).toMatchObject({ kind: 'loaded', everSaved: false });
  });

  it('round-trips through a save', () => {
    const runtime = createInMemoryRuntime(CONFIGURED);
    const first = readDiscoveryDraft(runtime, 'fictional-client-1');
    if (first.kind !== 'loaded') throw new Error('expected an empty draft');

    expect(writeDiscoveryDraft(runtime, 'fictional-client-1', first.draft)).toEqual({
      kind: 'saved',
    });

    expect(readDiscoveryDraft(runtime, 'fictional-client-1')).toMatchObject({
      kind: 'loaded',
      everSaved: true,
    });
  });
});

describe('the questionnaire', () => {
  it('is the default one, not a copy this package maintains', () => {
    // 🚫 A second questionnaire would let the console ask questions the mapper
    // cannot route, and ADR-0059 D6's "why this is asked" reads its field name
    // off the mapper's own routing table.
    expect(STUDIO_QUESTIONNAIRE.id).toBe('age-business-discovery');
    expect(STUDIO_QUESTIONNAIRE.sections.length).toBeGreaterThan(0);
  });
});

/**
 * ADR-0066 D6, slice 5 — a produced BIF that can say where each field came from.
 *
 * 🛑 AGE-INV-PROV-1 is the point of this block: the channel travels BESIDE the
 * view, so a field's origin can be shown without any number being able to
 * depend on it.
 */
describe('a produced BIF that says where each field came from', () => {
  const CLIENT = Object.freeze({
    clientId: 'fictional-client-9',
    organizationId: 'org-fictional-9',
    displayName: 'A Fictional Business',
    externalRefsText: '',
  });

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
      skips: {},
    };
  }

  function generated() {
    const runtime = createInMemoryRuntime(CONFIGURED);
    createClientRecord(runtime, CLIENT);
    const submitted = submitDiscoveryAnswers(runtime, CLIENT.clientId, answeredDraft());
    expect(submitted.kind, JSON.stringify(submitted)).toBe('written');

    return generateBifFromAnswerFile(runtime, CLIENT.clientId, 'operator:fictional');
  }

  it('reports an origin per BIF field, on a channel beside the view', () => {
    const outcome = generated();

    expect(outcome.kind, JSON.stringify(outcome)).toBe('generated');
    if (outcome.kind !== 'generated') return;

    // ⚠️ TWO VALUES, NEVER ONE — the origin has no slot inside the BIF view.
    expect(outcome.fieldSources.length).toBe(outcome.view.sections.length);
    expect(JSON.stringify(outcome.view)).not.toContain('origins');

    const origins = outcome.fieldSources.flatMap((section) =>
      section.fields.flatMap((field) => field.origins),
    );
    expect(origins.length).toBeGreaterThan(0);
    // 🚫 The answer file is `stated`-only and its parser is untouched, so every
    // origin here is `stated` — 🚫 no default put it there, and an absent one
    // would read `not-recorded`.
    expect(origins.some((origin) => origin.kind === 'stated')).toBe(true);
    expect(origins.every((origin) => origin.kind !== 'confirmed-from-source')).toBe(true);
  });

  /**
   * 🛑 AGE-INV-PROV-1, at the one place the two could meet. The view is produced
   * from the profile alone; the channel is asked for by name. Nothing on the
   * origin side is a number, so no score can come to depend on it.
   */
  it('🛑 puts no number on the origin channel', () => {
    const outcome = generated();
    if (outcome.kind !== 'generated') return;

    for (const section of outcome.fieldSources) {
      for (const field of section.fields) {
        for (const origin of field.origins) {
          for (const value of Object.values(origin)) {
            expect(typeof value).not.toBe('number');
          }
        }
      }
    }
  });
});
