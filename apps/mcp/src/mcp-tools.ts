import {
  assembleEvidence,
  assessCapabilityReadiness,
  createClientRecord,
  generateBifFromAnswerFile,
  readBusinessesView,
  readDiscoveryDraft,
  readOperatorSourceDocument,
  reportContradictions,
  resolveBusinessScope,
  submitDiscoveryAnswers,
  writeDiscoveryDraft,
  STUDIO_QUESTIONNAIRE,
  type OperatorDocumentDecoder,
  type OperatorWorkspaceRuntime,
} from '@age/operator-workspace';
import { sourceDocumentSchema, sourcePassageSchema } from '@age/assisted-intake';
import { relaySourceObservation } from '@age/source-observation';
import {
  recordPassageForQuestion,
  type ClientRecordDraft,
  type DiscoveryDraft,
} from '@age/studio-shell';

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
  /**
   * ⚠️ THE TWO TOOLS ADR-0066 D6 (slice 6) ADDS, AND ONLY THOSE TWO. They expose
   * the assisted-intake path the console already has (slice 4), over the SAME
   * implementation (ADR-0060 D2) — 🚫 not a new capability, and 🚫 not a third,
   * bulk or automatic variant.
   *
   * 🛑 **NEITHER TAKES A `clientId`, AND THAT IS DELIBERATE.** Reading a
   * document and accepting a passage happen against a file the operator named
   * and a questionnaire AGE ships; 🚫 nothing about them is tenant-scoped, so
   * neither accepts, persists, transforms or queues tenant-scoped data — which
   * is what ADR-0066 D7 forbids until `askEntitlement` has a real caller.
   */
  {
    name: 'age_read_source_document',
    actionClass: 'knowledge-authoring',
    description:
      'Read ONE plain-text document the operator names, by absolute path, and show its own sentences verbatim. ⚠️ AGE decides nothing from it and matches no sentence to any question. A file that is not plain text comes back as `not-extracted` with its reason — 🚫 never as a document that happened to contain nothing.',
    inputSchema: Object.freeze({
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            'Absolute path to the document, outside the repository working tree. 🚫 Never defaulted and never searched for — AGE reads the path it was given, or refuses.',
        },
        sourceId: {
          type: 'string',
          description:
            'Stable identity for this source. Operator-supplied — 🚫 never generated, because it is what a confirmed answer points back to.',
        },
        label: {
          type: 'string',
          description:
            'How the operator refers to this document. 🚫 Never derived from the document’s text.',
        },
      },
      required: ['path', 'sourceId', 'label'],
      additionalProperties: false,
    }),
  },
  {
    name: 'age_accept_source_passage',
    actionClass: 'knowledge-authoring',
    description:
      'Record that a NAMED HUMAN accepted one passage of one source as the answer to one question. ⚠️ The result is held for this call only — AGE stores nothing, and the answer file is unchanged. 🚫 An unknown question id is refused, never matched to the nearest one.',
    inputSchema: Object.freeze({
      type: 'object',
      properties: {
        questionId: {
          type: 'string',
          description:
            'A question id from `age_read_questionnaire`. 🚫 An id AGE does not know is refused.',
        },
        passage: {
          type: 'object',
          description:
            'One passage, exactly as `age_read_source_document` returned it — `passageId`, `locator` and the document’s own `text`. 🚫 There is no bulk arm.',
        },
        source: {
          type: 'object',
          description:
            'The document, exactly as `age_read_source_document` returned it. Its `sourceId` and the passage `locator` are what make the answer checkable afterwards.',
        },
        confirmedBy: {
          type: 'string',
          description:
            'The human who accepted it, e.g. "operator:jane". Required — 🚫 never defaulted or inferred, because this records that a person confirmed something.',
        },
      },
      required: ['questionId', 'passage', 'source', 'confirmedBy'],
      additionalProperties: false,
    }),
  },
  /**
   * ⚠️ THE ONE TOOL ADR-0069 D3 (deliverable 3) ADDS, AND ONLY THIS ONE.
   *
   * 🛑 **IT IS A RELAY, NOT AN INGESTION ENDPOINT.** Nothing listens; an operator
   * carries one observation across, one call at a time. 🚫 There is no bulk arm,
   * no queue, no scheduler, no poll and no "sync" — and 🚫 no second tool that
   * records what this one relayed.
   *
   * 🛑 **IT TAKES NO `clientId` AND READS NOTHING**, exactly as the two slice-6
   * tools do not. That is what keeps ADR-0066 D7 uncrossed BY SHAPE: this
   * surface accepts, persists, transforms and queues no tenant-scoped data,
   * because it holds none and can reach none.
   */
  {
    name: 'age_relay_source_observation',
    actionClass: 'knowledge-authoring',
    description:
      'Relay ONE observation from ONE external system, so AGE can check whether it is a statement AGE could work with. ⚠️ AGE STORES NOTHING — the result is held for this call only, and says so. ⚠️ Whether the observation names a subject AGE models is NOT assessed here and comes back as `not-assessed` with its reason — 🚫 that is neither a yes nor a no. 🚫 There is no bulk arm: one observation per call, on purpose.',
    inputSchema: Object.freeze({
      type: 'object',
      properties: {
        observation: {
          type: 'object',
          description:
            'One observation: `subject`, `claim`, `period`, `provenance` and `claimKind`. A missing part is refused by NAME — 🚫 never filled in, and 🚫 never guessed from the rest.',
        },
      },
      required: ['observation'],
      additionalProperties: false,
    }),
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
/**
 * 🛑 **THIS SERVER DECODES NOTHING, AND SAYS SO BY SHAPE (ADR-0070 D1).**
 *
 * ⚠️ ADR-0070 put `unpdf` at the CONSOLE's edge, in `@age/operator-document-decoder`,
 * and 🚫 nowhere else. `apps/mcp` therefore supplies the answer "no decoder
 * claims this file" for every document, which leaves this tool on route 1 —
 * plain text — exactly as it was before ADR-0070.
 *
 * 🚫 **DO NOT REPLACE THIS WITH A REAL DECODER.** Handing a model's tool call a
 * PDF decoder is a widening of what this surface may do to an operator's
 * documents, and it needs its own ADR. ⚠️ A PDF named here today is reported as
 * `not-plain-text` WITH its reason — 🚫 never as an empty document.
 */
const DECODES_NOTHING: OperatorDocumentDecoder = async () => ({ kind: 'no-decoder' });

export async function callAgeTool(
  runtime: OperatorWorkspaceRuntime,
  name: string,
  args: Readonly<Record<string, unknown>>,
): Promise<AgeToolResult> {
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

  if (name === 'age_read_source_document') {
    for (const key of ['path', 'sourceId', 'label']) {
      if (requiredString(args, key).kind === 'missing') {
        return refuse(`'${key}' is required and must be a non-empty string`);
      }
    }

    return report(
      await readOperatorSourceDocument(runtime, DECODES_NOTHING, {
        path: String(args.path),
        sourceId: String(args.sourceId),
        label: String(args.label),
      }),
    );
  }

  if (name === 'age_accept_source_passage') {
    const questionId = requiredString(args, 'questionId');
    if (questionId.kind === 'missing') {
      return refuse("'questionId' is required and must be a non-empty string");
    }

    const confirmedBy = requiredString(args, 'confirmedBy');
    if (confirmedBy.kind === 'missing') {
      // 🚫 NOT DEFAULTED. This field records that a PERSON confirmed a passage;
      // a generated value would attribute a human's judgement to nobody.
      return refuse("'confirmedBy' is required and must be a non-empty string");
    }

    // ⚠️ VALIDATED AGAINST THE SAME SCHEMAS the acceptance path already uses.
    // 🚫 Nothing is repaired, defaulted or coerced on the way through: a passage
    // whose locator a caller dropped would produce an answer that could not be
    // checked against the document afterwards.
    const passage = sourcePassageSchema.safeParse(args.passage);
    if (!passage.success) {
      return refuse(
        "'passage' must be a passage as `age_read_source_document` returned it, with `passageId`, `locator` and `text`",
      );
    }

    const source = sourceDocumentSchema.safeParse(args.source);
    if (!source.success) {
      return refuse(
        "'source' must be a document as `age_read_source_document` returned it, with `sourceId`, `label`, `kind`, `locator` and `text`",
      );
    }

    return report(
      recordPassageForQuestion({
        questionnaire: STUDIO_QUESTIONNAIRE,
        questionId: questionId.value,
        passage: passage.data,
        source: source.data,
        confirmedBy: confirmedBy.value,
      }),
    );
  }

  if (name === 'age_relay_source_observation') {
    // 🚫 `args.observation` is passed through UNTOUCHED. It is untrusted input
    // and `relaySourceObservation` is the only thing that decides about it —
    // pre-checking a field here would be a second, laxer acceptance path.
    return report(relaySourceObservation(args.observation));
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
