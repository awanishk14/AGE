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
