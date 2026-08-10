import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { AGE_MCP_TOOLS, callAgeTool, type AgeToolResult } from '../mcp-tools';
import {
  createInMemoryRuntime,
  FIXTURE_OPERATOR_DIRECTORY,
  FIXTURE_REPOSITORY_ROOT,
} from './in-memory-runtime';

/**
 * The tool surface (ADR-0060 D3/D4).
 *
 * 🚫 No fixture here names a real client — obvious fictionality is the guard
 * (ADR-0053 D3).
 */

const CONFIGURED = Object.freeze({
  AGE_CLIENT_RECORD_FILE: join(FIXTURE_OPERATOR_DIRECTORY, 'clients.json'),
  AGE_DISCOVERY_WORKSPACE: join(FIXTURE_OPERATOR_DIRECTORY, 'discovery'),
});

function payload(result: AgeToolResult): Record<string, unknown> {
  return JSON.parse(result.content[0]?.text ?? '') as Record<string, unknown>;
}

describe('the tool list', () => {
  it('offers class 1 and class 2 only, and no execution tool exists', () => {
    // 🛑 ADR-0057 D4: Business Execution is REFUSED, not postponed, and a
    // "preview" or "dry run" tool is still class 3.
    expect(AGE_MCP_TOOLS.length).toBeGreaterThan(0);

    for (const tool of AGE_MCP_TOOLS) {
      expect(['platform-administration', 'knowledge-authoring']).toContain(tool.actionClass);
      expect(tool.name).not.toMatch(/execute|send|publish|preview|dry[-_]?run/i);
    }
  });

  it('omits onboard, because ADR-0060 §6 Q1 is unanswered', () => {
    // 🛑 The first ADR-0054 D6 capture write must be the operator's own CLI
    // invocation — a tool call is easy for a model to make by accident, and
    // 🚫 ADR-0055 D7 has still never happened. 🚫 DO NOT SEED A ROW either.
    expect(AGE_MCP_TOOLS.map((tool) => tool.name)).not.toContain('age_onboard');
    expect(AGE_MCP_TOOLS.some((tool) => /onboard|capture|snapshot/i.test(tool.name))).toBe(false);
  });

  it('names every tool once', () => {
    const names = AGE_MCP_TOOLS.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('describes readiness as separate, never as a gate', () => {
    // ADR-0027: readiness is a separate named entry point, 🚫 never a gate on a
    // run. The description is what a model reads before choosing.
    const readiness = AGE_MCP_TOOLS.find((tool) => tool.name === 'age_assess_capability_readiness');
    expect(readiness?.description).toContain('never a gate');
  });
});

describe('an operator who has configured nothing', () => {
  it('is told which setting is missing, and it is an error, not an empty list', () => {
    // 🚫 "Nobody told me where to look" must never reach a model as "there are
    // no businesses" — one is a fact about the environment, the other a claim
    // about the operator's clients.
    const result = callAgeTool(createInMemoryRuntime({}), 'age_list_businesses', {});

    expect(result.isError).toBe(true);
    expect(payload(result)).toEqual({
      kind: 'not-configured',
      variable: 'AGE_CLIENT_RECORD_FILE',
    });
  });

  it('opens no file at all', () => {
    const runtime = createInMemoryRuntime({});
    callAgeTool(runtime, 'age_list_businesses', {});

    expect(runtime.calls.filter((call) => call.startsWith('readFileText'))).toEqual([]);
  });
});

describe('the arguments a tool refuses to invent', () => {
  it('refuses a missing clientId rather than guessing one', () => {
    const result = callAgeTool(createInMemoryRuntime(CONFIGURED), 'age_read_discovery_draft', {});

    expect(result.isError).toBe(true);
    expect(payload(result).reason).toContain('clientId');
  });

  it('refuses a missing changedBy rather than generating a principal', () => {
    // 🚫 ADR-0053 D4: no `operatorPrincipalOrDefault`, no principal derived from
    // the process, the hostname or the environment. A generated one would
    // record a run as asked for by someone who never asked.
    const result = callAgeTool(createInMemoryRuntime(CONFIGURED), 'age_assemble_evidence', {
      clientId: 'fictional-client-1',
    });

    expect(result.isError).toBe(true);
    expect(payload(result).reason).toContain('changedBy');
  });

  it('refuses an unknown tool without listing the others', () => {
    // 🚫 A tool list belongs in `tools/list`, not in an error a transcript keeps.
    const result = callAgeTool(createInMemoryRuntime(CONFIGURED), 'age_execute_campaign', {});

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text ?? '').not.toContain('age_list_businesses');
  });
});

describe('the refusals a tool must not smooth over', () => {
  it('refuses a record file inside the repository, and writes nothing', () => {
    // 🛑 ADR-0054 D2. A real client's data inside the working tree is one
    // `git add -A` away from being committed, and 🚫 private is not a control.
    const runtime = createInMemoryRuntime({
      AGE_CLIENT_RECORD_FILE: join(FIXTURE_REPOSITORY_ROOT, 'clients.json'),
    });

    const result = callAgeTool(runtime, 'age_create_business_record', {
      clientId: 'fictional-client-1',
      organizationId: 'org-fictional-1',
      displayName: 'A Fictional Business',
    });

    expect(result.isError).toBe(true);
    expect(runtime.calls.filter((call) => call.startsWith('writeFileText'))).toEqual([]);
  });

  it('reports an unknown clientId as its own kind, not as a business with no data', () => {
    const runtime = createInMemoryRuntime(CONFIGURED);
    callAgeTool(runtime, 'age_create_business_record', {
      clientId: 'fictional-client-1',
      organizationId: 'org-fictional-1',
      displayName: 'A Fictional Business',
    });

    const result = callAgeTool(runtime, 'age_resolve_business_scope', {
      clientId: 'fictional-client-2',
    });

    expect(result.isError).toBe(true);
    expect(payload(result).kind).toBe('unknown-client');
  });

  it('never returns a bare null, false, 0 or "none" as an answer', () => {
    // 🛑 D4's central refusal: an epistemic state that serialises to a falsy
    // value WILL be read as a negative finding by the next thing that touches
    // it. Every tool reachable without configuration is exercised.
    const runtime = createInMemoryRuntime({});
    let examined = 0;

    for (const tool of AGE_MCP_TOOLS) {
      const result = callAgeTool(runtime, tool.name, {
        clientId: 'fictional-client-1',
        changedBy: 'operator:fixture',
        draft: {},
      });
      examined += 1;

      // ⚠️ A MISSING entry collapses to '' here on purpose, so a tool that
      // returned no content at all fails the same assertion as one that
      // returned an empty answer — both are silence dressed as a reply.
      const text = result.content[0]?.text ?? '';
      expect(text.trim()).not.toBe('null');
      expect(text.trim()).not.toBe('');
      expect(payload(result).kind).toEqual(expect.any(String));
    }

    expect(examined).toBe(AGE_MCP_TOOLS.length);
  });
});

describe('a draft nobody has started', () => {
  it('says it was never saved, and that is an answer, not an error', () => {
    // ⚠️ "No file yet" is the ORDINARY state of a business nobody has started,
    // and a different fact from a draft that exists and cannot be read.
    const result = callAgeTool(createInMemoryRuntime(CONFIGURED), 'age_read_discovery_draft', {
      clientId: 'fictional-client-1',
    });

    expect(result.isError).toBeUndefined();
    expect(payload(result)).toMatchObject({ kind: 'loaded', everSaved: false });
  });
});

/**
 * ADR-0066 D6, slice 6 — the two assisted-intake tools.
 *
 * 🚫 The document below is obviously fictional, by rule (ADR-0053 D3), and the
 * "operator" is a fixture name, never a real person.
 */
describe('reading one source document over the tool surface', () => {
  const DOCUMENT_PATH = join(FIXTURE_OPERATOR_DIRECTORY, 'fictional-kite-brief.txt');

  function runtimeWithDocument(text: string) {
    const runtime = createInMemoryRuntime(CONFIGURED);
    runtime.files.set(DOCUMENT_PATH, text);
    return runtime;
  }

  it('shows the document’s own sentences and claims nothing about the business', () => {
    const result = callAgeTool(
      runtimeWithDocument('Fictional Kite Repairs mends kites. It was founded by two people.'),
      'age_read_source_document',
      { path: DOCUMENT_PATH, sourceId: 'src-fictional-brief', label: 'A fictional brief' },
    );

    const body = payload(result);
    expect(result.isError).toBeUndefined();
    expect(body.kind).toBe('read');
    expect(JSON.stringify(body)).toContain('Fictional Kite Repairs mends kites.');
    expect(String(body.notice)).toContain('decided nothing about this business');
  });

  it('🚫 refuses a path it was not given rather than searching for one', () => {
    // 🚫 ADR-0054 D2/D3: an operator file's path is never defaulted, and the
    // working directory is never searched for one.
    const runtime = runtimeWithDocument('Anything.');
    const result = callAgeTool(runtime, 'age_read_source_document', {
      sourceId: 'src-fictional-brief',
      label: 'A fictional brief',
    });

    expect(result.isError).toBe(true);
    expect(payload(result).reason).toContain('path');
    expect(runtime.calls.filter((call) => call.startsWith('readFileText'))).toEqual([]);
  });

  it('🚫 refuses a source it cannot identify, before reading anything', () => {
    const runtime = runtimeWithDocument('Anything.');
    const result = callAgeTool(runtime, 'age_read_source_document', {
      path: DOCUMENT_PATH,
      sourceId: 'src-fictional-brief',
      label: '   ',
    });

    expect(result.isError).toBe(true);
    expect(runtime.calls.filter((call) => call.startsWith('readFileText'))).toEqual([]);
  });

  it('🚫 never surfaces the message that embeds the operator’s directory layout', () => {
    // ⚠️ "Unreadable" is NOT "empty", and the system error carries the
    // operator's own paths into a transcript a model keeps.
    const result = callAgeTool(createInMemoryRuntime(CONFIGURED), 'age_read_source_document', {
      path: DOCUMENT_PATH,
      sourceId: 'src-fictional-brief',
      label: 'A fictional brief',
    });

    const text = result.content[0]?.text ?? '';
    expect(result.isError).toBe(true);
    expect(text).not.toContain('ENOENT');
    expect(text).toContain('not the same as the document');
  });
});

describe('accepting one passage over the tool surface', () => {
  const SOURCE = Object.freeze({
    sourceId: 'src-fictional-brief',
    label: 'A fictional brief',
    kind: 'plain-text',
    locator: 'A fictional brief',
    text: 'Fictional Kite Repairs mends kites.',
  });

  const PASSAGE = Object.freeze({
    passageId: 'p-1',
    locator: 'A fictional brief (sentence 1)',
    text: 'Fictional Kite Repairs mends kites.',
  });

  function firstQuestionId(): string {
    const questionnaire = payload(
      callAgeTool(createInMemoryRuntime({}), 'age_read_questionnaire', {}),
    ).questionnaire as { sections: { questions: { id: string }[] }[] };

    return questionnaire.sections[0]?.questions[0]?.id ?? '';
  }

  it('records the acceptance, and says plainly that nothing was stored', () => {
    // 🛑 `storage: 'not-stored'` IS THE HONEST ANSWER, not a defect. Durable
    // draft storage is a separate decision (ADR-0066 §0.5a, ADR-0067
    // `Proposed`), and 🚫 nothing here may learn how to write.
    const runtime = createInMemoryRuntime(CONFIGURED);
    const result = callAgeTool(runtime, 'age_accept_source_passage', {
      questionId: firstQuestionId(),
      passage: PASSAGE,
      source: SOURCE,
      confirmedBy: 'operator:fixture',
    });

    const body = payload(result);
    expect(result.isError).toBeUndefined();
    expect(body.kind).toBe('recorded');
    expect(body.storage).toBe('not-stored');
    expect(runtime.calls.filter((call) => call.startsWith('writeFileText'))).toEqual([]);
  });

  it('🚫 carries the full provenance, and never a bare `stated`', () => {
    // 🛑 ADR-0066 §0.4c: all three of `sourceId`, `locator` and `confirmedBy`,
    // or a refusal. 🚫 An incomplete provenance is NEVER downgraded to `stated`.
    const body = payload(
      callAgeTool(createInMemoryRuntime(CONFIGURED), 'age_accept_source_passage', {
        questionId: firstQuestionId(),
        passage: PASSAGE,
        source: SOURCE,
        confirmedBy: 'operator:fixture',
      }),
    );

    const serialised = JSON.stringify(body);
    expect(serialised).toContain('confirmed-from-source');
    expect(serialised).toContain('src-fictional-brief');
    expect(serialised).toContain('A fictional brief (sentence 1)');
    expect(serialised).toContain('operator:fixture');
  });

  it('🚫 refuses an unknown question rather than matching the nearest one', () => {
    const result = callAgeTool(createInMemoryRuntime(CONFIGURED), 'age_accept_source_passage', {
      questionId: 'no-such-question',
      passage: PASSAGE,
      source: SOURCE,
      confirmedBy: 'operator:fixture',
    });

    expect(result.isError).toBe(true);
    expect(payload(result).reason).toContain('refuses rather than choosing the closest');
  });

  it('🚫 refuses a passage whose locator was dropped, and repairs nothing', () => {
    // ⚠️ An answer whose locator is missing could not be checked against the
    // document afterwards, so it is refused rather than completed by AGE.
    const result = callAgeTool(createInMemoryRuntime(CONFIGURED), 'age_accept_source_passage', {
      questionId: firstQuestionId(),
      passage: { passageId: 'p-1', text: 'Fictional Kite Repairs mends kites.' },
      source: SOURCE,
      confirmedBy: 'operator:fixture',
    });

    expect(result.isError).toBe(true);
    expect(payload(result).reason).toContain('locator');
  });

  it('🚫 refuses a missing confirmedBy rather than attributing it to nobody', () => {
    const result = callAgeTool(createInMemoryRuntime(CONFIGURED), 'age_accept_source_passage', {
      questionId: firstQuestionId(),
      passage: PASSAGE,
      source: SOURCE,
    });

    expect(result.isError).toBe(true);
    expect(payload(result).reason).toContain('confirmedBy');
  });

  it('🚫 neither tool is tenant-scoped, so D7 is not crossed', () => {
    // 🛑 ADR-0066 D7: no inbound surface may accept, persist, transform or queue
    // TENANT-SCOPED data until `askEntitlement` has a real caller. Neither of
    // these two takes a clientId at all.
    const added = AGE_MCP_TOOLS.filter((tool) =>
      ['age_read_source_document', 'age_accept_source_passage'].includes(tool.name),
    );

    expect(added).toHaveLength(2);
    for (const tool of added) {
      const properties = (tool.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(Object.keys(properties)).not.toContain('clientId');
    }
  });
});

describe('the questionnaire tool', () => {
  it('hands back the questions, so the authoring tools are usable at all', () => {
    const result = callAgeTool(createInMemoryRuntime({}), 'age_read_questionnaire', {});
    const questionnaire = payload(result).questionnaire as Record<string, unknown>;

    expect(questionnaire.id).toBe('age-business-discovery');
    expect(Array.isArray(questionnaire.sections)).toBe(true);
  });

  it('touches nothing', () => {
    const runtime = createInMemoryRuntime({});
    callAgeTool(runtime, 'age_read_questionnaire', {});

    expect(runtime.calls).toEqual([]);
  });
});
