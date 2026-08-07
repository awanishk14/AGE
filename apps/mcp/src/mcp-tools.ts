import {
  assembleEvidence,
  assessCapabilityReadiness,
  createClientRecord,
  generateBifFromAnswerFile,
  readBusinessesView,
  readDiscoveryDraft,
  reportContradictions,
  resolveBusinessScope,
  submitDiscoveryAnswers,
  writeDiscoveryDraft,
  STUDIO_QUESTIONNAIRE,
  type OperatorWorkspaceRuntime,
} from '@age/operator-workspace';
import type { ClientRecordDraft, DiscoveryDraft } from '@age/studio-shell';

/**
 * The AGE tool surface, as a PURE function of its arguments (ADR-0060 D1/D3).
 *
 * ⚠️ THIS MODULE PERFORMS NO EFFECT AND SPEAKS NO PROTOCOL. It maps a tool name
 * and its arguments onto `@age/operator-workspace` — the SAME implementation the
 * console calls (D2) — and hands back the outcome. Every effect arrives as
 * `runtime`, and `src/main.ts` is the only module in this app that has one.
 *
 * 🛑 D4 IS THE DECISION MOST LIKELY TO BE UNDONE HERE, because the pressure is
 * real and sounds helpful: a model consuming a tool result prefers total, tidy,
 * machine-shaped answers, and AGE's answers are deliberately none of those.
 * 🚫 An outcome is serialised WHOLE. Do not lift a "summary" out of it, do not
 * drop a field a model "does not need", and do not translate `not-assessed`
 * into `null`, `0`, `false`, `"none"` or an omitted key — an epistemic state
 * that serialises to a falsy value WILL be read as a negative finding by the
 * next thing that touches it.
 *
 * 🚫 THERE IS NO `execute_*` TOOL AND THERE MUST NEVER BE ONE. Business
 * Execution is class 3 under ADR-0057 D4 — refused, not postponed — and a
 * "preview" or "dry run" tool is still class 3.
 *
 * 🚫 `onboard` (the ADR-0054 D6 capture write) IS DELIBERATELY ABSENT. ADR-0060
 * §6 Q1 is unanswered: the first such write must be the operator's own CLI
 * invocation (ADR-0055 D7 has still never happened), precisely because a tool
 * call is easy for a model to make by accident. Adding it needs that question
 * answered, not a judgement call in this file.
 */

export interface AgeToolContent {
  readonly type: 'text';
  readonly text: string;
}

export interface AgeToolResult {
  readonly content: readonly AgeToolContent[];
  /**
   * ⚠️ TRUE ONLY FOR A REFUSAL — a state in which AGE did not answer the
   * question. 🚫 It is never set for an answer that happens to be
   * `not-assessed`: that IS an answer, and flagging it as an error would tell a
   * model AGE had failed when AGE had in fact reported, correctly, that it
   * cannot yet say.
   */
  readonly isError?: boolean;
}

export interface AgeToolDescriptor {
  readonly name: string;
  /** ADR-0057 D4's class. 🚫 There is no class 3 entry, by decision. */
  readonly actionClass: 'platform-administration' | 'knowledge-authoring';
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
}

const NO_ARGUMENTS = Object.freeze({
  type: 'object',
  properties: {},
  additionalProperties: false,
});

function withClientId(extra: Readonly<Record<string, unknown>> = {}, required: string[] = []) {
  return Object.freeze({
    type: 'object',
    properties: {
      clientId: {
        type: 'string',
        description:
          'The business, by the id in the operator’s own record file. AGE does not guess it and does not list businesses it was not told about.',
      },
      ...extra,
    },
    required: ['clientId', ...required],
    additionalProperties: false,
  });
}

/**
 * ⚠️ `changedBy` is PROVENANCE, never authorization (ADR-0053 D4, ADR-0060 D5).
 * The caller asserts it and AGE believes it; that is honest only because the
 * transport is stdio and the machine is the operator's own. 🚫 It is never
 * defaulted, never generated, and never derived from the process, the hostname
 * or the environment.
 */
const CHANGED_BY = Object.freeze({
  changedBy: {
    type: 'string',
    description:
      'Who to record as having asked, e.g. "operator:jane". Recorded as provenance — it grants nothing and is never an authorization decision.',
  },
});

const DRAFT_SCHEMA = Object.freeze({
  draft: {
    type: 'object',
    description:
      'The discovery draft. An unanswered question is ABSENT from `answers` — never an empty string — and a deliberate pass sits in `skips` with the operator’s reason.',
  },
});

export const AGE_MCP_TOOLS: readonly AgeToolDescriptor[] = Object.freeze([
  {
    name: 'age_list_businesses',
    actionClass: 'platform-administration',
    description:
      'List the businesses in the operator’s own client record file. If no record file has been named, says which setting is missing — it never reports an empty list, because "nobody told me where to look" is a fact about the environment, not about the operator’s clients.',
    inputSchema: NO_ARGUMENTS,
  },
  {
    name: 'age_read_questionnaire',
    actionClass: 'knowledge-authoring',
    description:
      'The discovery questionnaire the console asks, with its sections and question ids. Read this before writing a draft: a question id AGE does not know is refused, and the mapper routes answers by field name.',
    inputSchema: NO_ARGUMENTS,
  },
  {
    name: 'age_resolve_business_scope',
    actionClass: 'platform-administration',
    description:
      'Resolve one business to its record. The organization is DERIVED from the record — 🚫 it can never be typed, chosen or passed in.',
    inputSchema: withClientId(),
  },
  {
    name: 'age_create_business_record',
    actionClass: 'platform-administration',
    description:
      'Add a business to the operator’s record file. Writes only to the file the operator named, which must be outside the repository.',
    inputSchema: Object.freeze({
      type: 'object',
      properties: {
        clientId: { type: 'string' },
        organizationId: { type: 'string' },
        displayName: { type: 'string' },
        externalRefsText: { type: 'string' },
      },
      required: ['clientId', 'organizationId', 'displayName'],
      additionalProperties: false,
    }),
  },
  {
    name: 'age_read_discovery_draft',
    actionClass: 'knowledge-authoring',
    description:
      'Read the saved discovery draft. "No file yet" is the ordinary state of a business nobody has started and is reported as `everSaved: false` — a different fact from a draft that exists and cannot be read.',
    inputSchema: withClientId(),
  },
  {
    name: 'age_write_discovery_draft',
    actionClass: 'knowledge-authoring',
    description:
      'Save the discovery draft. Answering clears a skip and skipping clears an answer, so no question is ever both.',
    inputSchema: withClientId(DRAFT_SCHEMA, ['draft']),
  },
  {
    name: 'age_submit_discovery_answers',
    actionClass: 'knowledge-authoring',
    description:
      'Write the canonical Answer File from the draft. Refuses while a required question is unanswered — 🚫 a deliberate skip does NOT satisfy a required question.',
    inputSchema: withClientId(DRAFT_SCHEMA, ['draft']),
  },
  {
    name: 'age_generate_bif',
    actionClass: 'knowledge-authoring',
    description:
      'Run the real discovery→BIF chain over the answer file that was written. Reports four separate scores. 🚫 They are never combined into one number, and a section AGE could not populate is OMITTED, never placeholder-filled.',
    inputSchema: withClientId(CHANGED_BY, ['changedBy']),
  },
  {
    name: 'age_assemble_evidence',
    actionClass: 'knowledge-authoring',
    description:
      'Assemble the evidence behind what AGE says about this business, each item with its provenance.',
    inputSchema: withClientId(CHANGED_BY, ['changedBy']),
  },
  {
    name: 'age_report_contradictions',
    actionClass: 'knowledge-authoring',
    description:
      'Report contradictions found in the assembled evidence. ⚠️ Over an empty evidence set this says AGE has nothing to check — 🚫 it must never be read as "AGE checked and it is sound".',
    inputSchema: withClientId(CHANGED_BY, ['changedBy']),
  },
  {
    name: 'age_assess_capability_readiness',
    actionClass: 'knowledge-authoring',
    description:
      'Assess what the capabilities would have to work with. ⚠️ A SEPARATE tool on purpose (ADR-0027) — 🚫 it is never a gate on any other tool, and a business that has not adopted something is `not-assessed`, never "not ready".',
    inputSchema: withClientId(CHANGED_BY, ['changedBy']),
  },
]);

/**
 * 🚫 A refusal names a POSITION, never record contents, and never another
 * client's id (ADR-0054 D3). ⚠️ A tool error is read by a model that may quote
 * it back into a transcript, so it must carry no client name at all.
 */
function refuse(reason: string): AgeToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ kind: 'refused', reason }, null, 2) }],
    isError: true,
  };
}

/**
 * ⚠️ These three kinds mean AGE DID NOT ANSWER. Everything else — including an
 * answer whose content is `not-assessed` — is a real answer and is not an error.
 */
const REFUSAL_KINDS: ReadonlySet<string> = new Set(['not-configured', 'refused', 'unknown-client']);

function report(
  outcome: { readonly kind: string } & Readonly<Record<string, unknown>>,
): AgeToolResult {
  // 🚫 SERIALISED WHOLE. No field is lifted out, summarised or dropped: the
  // reason attached to a refusal, and the omissions attached to an answer, are
  // the parts a model is most likely to need and least likely to ask for.
  const result: AgeToolResult = {
    content: [{ type: 'text', text: JSON.stringify(outcome, null, 2) }],
  };

  return REFUSAL_KINDS.has(outcome.kind) ? { ...result, isError: true } : result;
}

function requiredString(
  args: Readonly<Record<string, unknown>>,
  key: string,
): { readonly kind: 'ok'; readonly value: string } | { readonly kind: 'missing' } {
  const value = args[key];
  return typeof value === 'string' && value.trim() !== ''
    ? { kind: 'ok', value }
    : { kind: 'missing' };
}

/**
 * Call one AGE tool.
 *
 * 🚫 `runtime` is the FIRST parameter and is never defaulted — a default would
 * make this whole surface unfalsifiable behind a signature that only looks
 * parameterised (ADR-0049 D2's reasoning, applied here).
 */
export function callAgeTool(
  runtime: OperatorWorkspaceRuntime,
  name: string,
  args: Readonly<Record<string, unknown>>,
): AgeToolResult {
  if (!AGE_MCP_TOOLS.some((tool) => tool.name === name)) {
    // ⚠️ Named, so a model can correct itself, and 🚫 without listing the other
    // tools: a tool list belongs in `tools/list`, not in an error a transcript
    // keeps.
    return refuse(`no AGE tool is named '${name}'`);
  }

  if (name === 'age_list_businesses') {
    return report(readBusinessesView(runtime));
  }

  if (name === 'age_read_questionnaire') {
    // ⚠️ NOT an operation on the operator's workspace — it is the same constant
    // the console renders, and it touches nothing. It is here because without
    // the question ids the authoring tools cannot be used at all, and a tool
    // surface that cannot be used is a false capability.
    return report({ kind: 'questionnaire', questionnaire: STUDIO_QUESTIONNAIRE });
  }

  if (name === 'age_create_business_record') {
    for (const key of ['clientId', 'organizationId', 'displayName']) {
      if (requiredString(args, key).kind === 'missing') {
        return refuse(`'${key}' is required and must be a non-empty string`);
      }
    }

    const draft: ClientRecordDraft = {
      clientId: String(args.clientId),
      organizationId: String(args.organizationId),
      displayName: String(args.displayName),
      externalRefsText: typeof args.externalRefsText === 'string' ? args.externalRefsText : '',
    };

    return report(createClientRecord(runtime, draft));
  }

  const clientId = requiredString(args, 'clientId');
  if (clientId.kind === 'missing') {
    return refuse("'clientId' is required and must be a non-empty string");
  }

  if (name === 'age_resolve_business_scope') {
    return report(resolveBusinessScope(runtime, clientId.value));
  }

  if (name === 'age_read_discovery_draft') {
    return report(readDiscoveryDraft(runtime, clientId.value));
  }

  if (name === 'age_write_discovery_draft' || name === 'age_submit_discovery_answers') {
    const draft = args.draft;
    if (typeof draft !== 'object' || draft === null || Array.isArray(draft)) {
      return refuse("'draft' is required and must be an object");
    }

    return report(
      name === 'age_write_discovery_draft'
        ? writeDiscoveryDraft(runtime, clientId.value, draft as DiscoveryDraft)
        : submitDiscoveryAnswers(runtime, clientId.value, draft as DiscoveryDraft),
    );
  }

  const changedBy = requiredString(args, 'changedBy');
  if (changedBy.kind === 'missing') {
    // 🚫 NOT DEFAULTED. A generated principal would record a run as having been
    // asked for by someone who never asked (ADR-0053 D4).
    return refuse("'changedBy' is required and must be a non-empty string");
  }

  if (name === 'age_generate_bif') {
    return report(generateBifFromAnswerFile(runtime, clientId.value, changedBy.value));
  }

  if (name === 'age_assemble_evidence') {
    return report(assembleEvidence(runtime, clientId.value, changedBy.value));
  }

  if (name === 'age_report_contradictions') {
    return report(reportContradictions(runtime, clientId.value, changedBy.value));
  }

  return report(assessCapabilityReadiness(runtime, clientId.value, changedBy.value));
}
