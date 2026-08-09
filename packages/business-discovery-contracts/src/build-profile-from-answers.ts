import type { BusinessDiscoveryProfile } from './business-discovery-profile';
import type { DiscoveryAnswer } from './discovery-answer';
import type { DiscoveryQuestion } from './discovery-question';
import type { DiscoverySection } from './discovery-section';
import type { CustomerSegment } from './customer-segment';
import type { CompetitorReference } from './competitor-reference';
import type { BusinessGoal } from './business-goal';
import type { Offering } from './offering';
import type { EvidenceSourceRef } from './evidence-source-ref';
import {
  EVIDENCE_SOURCE_KINDS,
  OFFERING_KINDS,
  type DiscoverySectionId,
  type EvidenceSourceKind,
  type OfferingKind,
} from './enums';
import {
  PROFILE_SIGNALS,
  type BusinessDiscoveryQuestionnaire,
  type BusinessDiscoveryQuestionnaireQuestion,
  type ProfileSignal,
} from './questionnaire';
import { PROFILE_SIGNAL_TO_FIELD_PATH } from './field-provenance';
import type {
  ProfileFieldProvenance,
  ProfileFieldProvenanceEntry,
} from './profile-field-provenance';

/**
 * buildProfileFromAnswers — the producing direction (ADR-0050).
 *
 * `validateProfileAgainstQuestionnaire` has always been able to CHECK whether a
 * profile answers a questionnaire. Nothing could PRODUCE one: no function in the
 * repository returned a `BusinessDiscoveryProfile`, so ADR-0049's required
 * profile parameter was, in practice, reachable with exactly one argument — the
 * hand-authored sample. This closes that.
 *
 * ⚠️ THE WHOLE HAZARD IS TRANSCRIPTION VS INFERENCE (ADR-0050 D2). An answer is
 * prose; the structured fields are typed. This function only ever copies an
 * answer's text VERBATIM into a field that can hold it, and OMITS every field it
 * has no answer for. It never splits one prose answer into several entries,
 * never derives an enum from wording, and never placeholder-fills. A sparse
 * profile is the correct output of a sparse answer set, not a degraded one —
 * `calculateBusinessDiscoveryCompleteness` and the readiness layer exist to
 * report exactly that sparsity (ADR-0026 D4: a limitation, never negative
 * evidence).
 *
 * Pure and deterministic: no clock, no generated identifiers, no randomness, no
 * I/O. Output ordering follows the QUESTIONNAIRE's section and question order,
 * not the caller's answer order, so the same answers in any order produce an
 * identical profile.
 */

/**
 * How a `ProfileSignal`'s answer may be written into the profile.
 *
 * - `scalar` — a single string field, copied verbatim.
 * - `stringList` — a `readonly string[]` field; every answer value verbatim.
 * - `namedList` — a `{ id, <label> , …all other fields optional }` collection;
 *   one entry per answer value, the text verbatim as the label, and every
 *   optional field left absent.
 * - `kindedList` — a collection whose entries carry a REQUIRED enum the answer
 *   does not contain. The enum comes from the QUESTION's `entryKind`
 *   (ADR-0051 D2/D3), never from the answer's wording; the answer still supplies
 *   only the text, verbatim.
 * - `untranscribable` — the target REQUIRES a field no answer can supply and no
 *   question can pin. A refusal, not an omission.
 *
 * ⚠️ `untranscribable` currently has NO members: ADR-0051 D4 moved `offerings`
 * and `evidenceSources` to `kindedList`, and those were the only two. The
 * variant is kept deliberately — it is the vocabulary for the next field whose
 * required data no answer supplies, and deleting it would make the next such
 * refusal look like an oversight rather than a decision.
 */
type SignalTarget =
  | {
      readonly kind: 'scalar';
      readonly field: 'businessName' | 'industry' | 'businessModel' | 'brandPositioning';
    }
  | {
      readonly kind: 'stringList';
      readonly field: 'geographies' | 'marketingChannels' | 'constraints' | 'assets';
    }
  | { readonly kind: 'namedList'; readonly field: 'segments' | 'competitors' | 'goals' }
  | {
      readonly kind: 'kindedList';
      readonly field: 'offerings' | 'evidenceSources';
      /** The enum a question targeting this signal must pin, by allowed value. */
      readonly entryKinds: readonly string[];
    }
  | { readonly kind: 'untranscribable'; readonly because: string };

/**
 * ADR-0050 D3 — `satisfiedBy` IS THE ROUTING TABLE, and this is its only
 * elaboration. A question populates a structured field if and only if it
 * declares `satisfiedBy`, and the target is whatever that signal names here.
 * No name matching, no prompt parsing, no per-question special cases.
 *
 * ⚠️ Exhaustive over `PROFILE_SIGNALS` BY TYPE — adding a signal without a
 * target here is a compile error, and a test pins the two to the same closed
 * set so the producing and checking directions cannot drift apart.
 */
export const PROFILE_SIGNAL_TARGETS: Readonly<Record<ProfileSignal, SignalTarget>> = {
  businessName: { kind: 'scalar', field: 'businessName' },
  industry: { kind: 'scalar', field: 'industry' },
  businessModel: { kind: 'scalar', field: 'businessModel' },
  brandPositioning: { kind: 'scalar', field: 'brandPositioning' },

  geographies: { kind: 'stringList', field: 'geographies' },
  marketingChannels: { kind: 'stringList', field: 'marketingChannels' },
  constraints: { kind: 'stringList', field: 'constraints' },
  assets: { kind: 'stringList', field: 'assets' },

  segments: { kind: 'namedList', field: 'segments' },
  competitors: { kind: 'namedList', field: 'competitors' },
  goals: { kind: 'namedList', field: 'goals' },

  // ⚠️ ADR-0051 D4. These two were `untranscribable` under ADR-0050 because
  // `Offering.type` and `EvidenceSourceRef.kind` are required enums no answer
  // supplies — correct then, and STILL correct about the answer. What changed is
  // that the QUESTION can now pin the enum (`entryKind`), so the value comes
  // from the questionnaire author at design time rather than from prose.
  //
  // ⚠️ ADR-0050 D2 is intact, not weakened. Do NOT "complete" this by defaulting
  // `type` to 'service' or by reading product-vs-service out of the answer's
  // wording: product-vs-service is a real business fact about the offering, not
  // a formatting choice, and a wrong one is a fabricated conclusion about
  // someone's business. A question with no `entryKind` is rejected, never
  // guessed.
  offerings: { kind: 'kindedList', field: 'offerings', entryKinds: OFFERING_KINDS },
  evidenceSources: {
    kind: 'kindedList',
    field: 'evidenceSources',
    entryKinds: EVIDENCE_SOURCE_KINDS,
  },
};

/** Required caller-supplied identity (ADR-0050 D5). Never defaulted, never generated. */
export interface BuildProfileFromAnswersOptions {
  /** Profile identifier. The caller owns identity; this function invents none. */
  readonly id: string;
  /** ISO-8601 capture timestamp. Caller-supplied — this function reads no clock. */
  readonly capturedAt: string;
}

/** Every non-empty, trimmed value an answer carries, in the order given. */
function answerValues(answer: DiscoveryAnswer): readonly string[] {
  const raw = Array.isArray(answer.value) ? answer.value : [answer.value as string];
  return raw.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

/** Drop `critical` and `satisfiedBy`: a profile section carries `DiscoveryQuestion`, not the questionnaire's shape. */
function toDiscoveryQuestion(question: BusinessDiscoveryQuestionnaireQuestion): DiscoveryQuestion {
  return {
    id: question.id,
    sectionId: question.sectionId,
    prompt: question.prompt,
    required: question.required,
    kind: question.kind,
    // ⚠️ Field-by-field, and `choices` conditionally — never a spread. A spread
    // would carry `critical`/`satisfiedBy` into a shape that does not declare
    // them, and would write `choices: undefined` where the source has no key.
    ...(question.choices === undefined ? {} : { choices: question.choices }),
  };
}

/**
 * A profile and, on a SEPARATE channel, where each of its structured fields came
 * from (ADR-0066 D2).
 *
 * ⚠️ Two values, never one. `fieldProvenance` has no slot on
 * `BusinessDiscoveryProfile` and is never folded into `fieldEvidence`, so
 * AGE-INV-PROV-1 — identical facts with different provenance produce
 * byte-identical scores — holds by SHAPE and not only by test.
 */
export interface ProfileAndFieldProvenance {
  readonly profile: BusinessDiscoveryProfile;
  readonly fieldProvenance: ProfileFieldProvenance;
}

/**
 * buildProfileAndFieldProvenanceFromAnswers — map a questionnaire answer set to
 * a `BusinessDiscoveryProfile` by transcription only, AND record, on a separate
 * channel, which question and which `AnswerProvenance` produced each structured
 * field.
 *
 * ⚠️ ONE TRAVERSAL, ONE ROUTING TABLE. The provenance is recorded at the exact
 * point the value is written, from `PROFILE_SIGNAL_TARGETS` and
 * `PROFILE_SIGNAL_TO_FIELD_PATH` — 🚫 never by a second pass over the finished
 * profile, which could report an origin for a field the mapper did not actually
 * write, and would drift the first time either table changed.
 *
 * 🚫 It records ORIGIN, never worth. Nothing here reads the provenance's `kind`,
 * branches on it, counts it, or lets it change what is written: an answer typed
 * by the client and an answer confirmed against a document produce the SAME
 * profile, byte for byte (AGE-INV-PROV-1).
 *
 * @throws exactly as `buildProfileFromAnswers` does — the checks are these, and
 * the messages keep that name because it is the entry point callers use.
 *
 * ⚠️ The business-name throw is NOT "an unanswered question is an error" —
 * ADR-0050 D4 says the opposite and this function honours it: every other
 * unanswered or unmapped question simply contributes nothing and leaves the
 * profile sparse. `businessName` is the single field the profile schema itself
 * makes required and non-empty, so without it there is no valid profile to
 * return and the only alternative would be to invent one.
 */
export function buildProfileAndFieldProvenanceFromAnswers(
  answers: readonly DiscoveryAnswer[],
  questionnaire: BusinessDiscoveryQuestionnaire,
  options: BuildProfileFromAnswersOptions,
): ProfileAndFieldProvenance {
  if (!Array.isArray(answers)) {
    throw new TypeError('buildProfileFromAnswers requires an answers array');
  }
  if (questionnaire?.sections === undefined || questionnaire.sections.length === 0) {
    throw new TypeError(
      'buildProfileFromAnswers requires a questionnaire with at least one section',
    );
  }
  if (typeof options?.id !== 'string' || options.id.trim().length === 0) {
    throw new TypeError('buildProfileFromAnswers requires a caller-supplied options.id');
  }
  if (typeof options?.capturedAt !== 'string' || options.capturedAt.trim().length === 0) {
    throw new TypeError('buildProfileFromAnswers requires a caller-supplied options.capturedAt');
  }

  // The questionnaire is an ARBITRARY caller-supplied argument, not necessarily
  // `DEFAULT_BUSINESS_DISCOVERY_QUESTIONNAIRE`. Two structural mistakes in it
  // would otherwise cause SILENT structured data loss — the answer would still
  // be recorded under D6, so the profile would look complete while a structured
  // field quietly held only one of the values it was given. Both are rejected
  // here rather than tolerated.
  //
  // ⚠️ This is NOT the D4 rule. An unanswered or unmapped QUESTION is never an
  // error and leaves the profile sparse. A malformed QUESTIONNAIRE is a caller
  // defect, in the same class as passing no sections at all.
  // ⚠️ ADR-0051 §3 — this check is NARROWED, never removed. D1–D4 make two
  // questions legitimately target `offerings` (one per `OfferingKind`), so the
  // flat "at most one question per signal" rule would now reject the default
  // questionnaire. The defect it was written to close is a SECOND CLAIM
  // OVERWRITING THE FIRST, and that is still rejected everywhere it can happen:
  // a kinded list APPENDS rather than overwrites, so a second question is safe
  // there and only there — and only when it pins a DIFFERENT enum value.
  const claimedBy = new Map<string, string>();
  for (const section of questionnaire.sections) {
    for (const question of section.questions) {
      if (question.satisfiedBy === undefined) {
        continue;
      }
      const target = PROFILE_SIGNAL_TARGETS[question.satisfiedBy];

      if (target.kind === 'kindedList') {
        // The enum is required ON THE QUESTION. Absent, it would have to be
        // invented — the inference ADR-0050 D2 prohibits — so this is a caller
        // defect, not a sparse answer.
        if (question.entryKind === undefined) {
          throw new TypeError(
            `buildProfileFromAnswers requires question '${question.id}' to declare an entryKind: the signal '${question.satisfiedBy}' writes entries carrying a required enum that no answer supplies, and this function invents none.`,
          );
        }
        if (!target.entryKinds.includes(question.entryKind)) {
          throw new TypeError(
            `buildProfileFromAnswers cannot pin entryKind '${question.entryKind}' on question '${question.id}': the signal '${question.satisfiedBy}' accepts only ${target.entryKinds.join(' | ')}.`,
          );
        }
      } else if (question.entryKind !== undefined) {
        throw new TypeError(
          `buildProfileFromAnswers cannot apply the entryKind '${question.entryKind}' declared on question '${question.id}': the signal '${question.satisfiedBy}' writes no kinded entries, so the value would be silently ignored.`,
        );
      }

      // Keyed by signal AND pinned enum: two offerings questions coexist only
      // while they collect different kinds. Two questions pinning 'product'
      // would be the original overwrite hazard wearing the new shape.
      const claim = `${question.satisfiedBy}:${question.entryKind ?? ''}`;
      const owner = claimedBy.get(claim);
      if (owner !== undefined) {
        throw new TypeError(
          `buildProfileFromAnswers requires at most one question per profile signal: '${question.satisfiedBy}' is claimed by both '${owner}' and '${question.id}'. A second claim would overwrite the first answer's structured value without reporting it.`,
        );
      }
      claimedBy.set(claim, question.id);

      // A `list` answer carries many values; a scalar field holds one. Routing
      // one to the other keeps `values[0]` and drops the rest.
      if (target.kind === 'scalar' && question.kind === 'list') {
        throw new TypeError(
          `buildProfileFromAnswers cannot route the list question '${question.id}' to the single-valued signal '${question.satisfiedBy}': all but the first value would be silently discarded.`,
        );
      }
    }
  }

  // Answers are indexed by question id, so output order is driven by the
  // questionnaire rather than by the order the caller happened to submit.
  const byQuestionId = new Map<string, DiscoveryAnswer>();
  for (const answer of answers) {
    if (answerValues(answer).length > 0) {
      byQuestionId.set(answer.questionId, answer);
    }
  }

  let businessName: string | undefined;
  const scalars = new Map<string, string>();
  const stringLists = new Map<string, string[]>();
  const segments: CustomerSegment[] = [];
  const competitors: CompetitorReference[] = [];
  const goals: BusinessGoal[] = [];
  const offerings: Offering[] = [];
  const evidenceSources: EvidenceSourceRef[] = [];
  const sections: DiscoverySection[] = [];
  // 🚫 A SEPARATE accumulator, never a field on anything above. Nothing below
  // reads it back, so it cannot influence a single transcribed value.
  const provenanceEntries: ProfileFieldProvenanceEntry[] = [];

  for (const section of questionnaire.sections) {
    const sectionAnswers: DiscoveryAnswer[] = [];

    for (const question of section.questions) {
      const answer = byQuestionId.get(question.id);
      if (answer === undefined) {
        // ADR-0050 D4 — not an error. The profile stays sparse.
        continue;
      }

      // D6: recorded as an answer whether or not it also feeds a structured
      // signal, so the two representations cannot disagree.
      sectionAnswers.push(answer);

      if (question.satisfiedBy === undefined) {
        continue;
      }

      const target = PROFILE_SIGNAL_TARGETS[question.satisfiedBy];
      const values = answerValues(answer);

      // ADR-0066 D2 — recorded HERE, at the point the field is written, and
      // only for signals that reach a nameable field. `evidenceSources` has no
      // entry in `PROFILE_SIGNAL_TO_FIELD_PATH` (an evidence list citing its own
      // origin is circular) and an `untranscribable` target writes nothing at
      // all, so neither may claim a field's origin.
      const fieldPath = PROFILE_SIGNAL_TO_FIELD_PATH[question.satisfiedBy];
      if (fieldPath !== undefined && target.kind !== 'untranscribable') {
        provenanceEntries.push({
          fieldPath,
          questionId: question.id,
          // 🚫 Copied, never inspected: no branch below sees this value.
          provenance: answer.provenance,
        });
      }

      switch (target.kind) {
        case 'scalar': {
          const [first] = values;
          // `values` is non-empty by construction (blank answers never enter
          // the index), but a scalar field must never be written `undefined` —
          // that would be a present key with no value, which is neither an
          // answer nor an honest omission.
          if (first !== undefined) {
            if (target.field === 'businessName') {
              businessName = first;
            } else {
              scalars.set(target.field, first);
            }
          }
          break;
        }
        case 'stringList': {
          const existing = stringLists.get(target.field) ?? [];
          stringLists.set(target.field, [...existing, ...values]);
          break;
        }
        case 'namedList': {
          values.forEach((text, index) => {
            // A synthetic identifier derived from the question id. An id is an
            // identifier, not content — nothing about the business is invented.
            const id = `${question.id}-${index + 1}`;
            if (target.field === 'segments') {
              segments.push({ id, name: text });
            } else if (target.field === 'competitors') {
              competitors.push({ id, name: text });
            } else {
              goals.push({ id, statement: text });
            }
          });
          break;
        }
        case 'kindedList': {
          // The enum was validated above and comes from the QUESTION; the text
          // comes from the ANSWER, verbatim. Every other field of the entry —
          // `description`, `valueProposition`, `locator` — stays absent, exactly
          // as for a `namedList` (ADR-0050 D2, unchanged by ADR-0051).
          values.forEach((text, index) => {
            const id = `${question.id}-${index + 1}`;
            if (target.field === 'offerings') {
              offerings.push({ id, name: text, type: question.entryKind as OfferingKind });
            } else {
              evidenceSources.push({
                id,
                label: text,
                kind: question.entryKind as EvidenceSourceKind,
              });
            }
          });
          break;
        }
        case 'untranscribable':
          // Deliberately nothing. The answer is still recorded above, so the
          // operator's words are never lost — only the structured collection
          // this function may not fabricate is left empty.
          break;
      }
    }

    if (sectionAnswers.length > 0) {
      sections.push({
        id: section.id as DiscoverySectionId,
        name: section.name,
        questions: section.questions.map(toDiscoveryQuestion),
        answers: sectionAnswers,
      });
    }
  }

  if (businessName === undefined) {
    throw new TypeError(
      'buildProfileFromAnswers requires an answer satisfying the businessName signal: the profile schema requires a non-empty businessName and this function invents none',
    );
  }

  const optionalScalar = (field: string): Record<string, string> => {
    const value = scalars.get(field);
    // Omitted, never placeholder-filled (ADR-0050 D2).
    return value === undefined ? {} : { [field]: value };
  };

  const profile: BusinessDiscoveryProfile = {
    id: options.id,
    businessName,
    ...optionalScalar('industry'),
    ...optionalScalar('businessModel'),
    ...optionalScalar('brandPositioning'),

    geographies: stringLists.get('geographies') ?? [],
    marketingChannels: stringLists.get('marketingChannels') ?? [],
    constraints: stringLists.get('constraints') ?? [],
    assets: stringLists.get('assets') ?? [],

    sections,
    segments,
    competitors,
    goals,

    offerings,
    evidenceSources,

    // ⚠️ Empty by decision, not by oversight:
    // - `assumptions` — an assumption is a judgement about the business; reading
    //   one out of an answer is inference.
    // - `gaps` — `validateProfileAgainstQuestionnaire` derives these from the
    //   profile and the questionnaire. Writing them here would duplicate that
    //   and let the two disagree.
    // - `fieldEvidence` — omitted entirely; a profile that cites nothing is
    //   exactly as valid as before that field existed.
    assumptions: [],
    gaps: [],

    capturedAt: options.capturedAt,
  };

  return {
    profile,
    fieldProvenance: { profileId: options.id, entries: provenanceEntries },
  };
}

/**
 * buildProfileFromAnswers — map a questionnaire answer set to a
 * `BusinessDiscoveryProfile` by transcription only.
 *
 * ⚠️ The profile alone, deliberately. Every scorer, the BIF mapper and the
 * readiness layer call THIS one, and it hands them nothing to condition on:
 * provenance is available only to a caller that asks for it BY NAME, through
 * `buildProfileAndFieldProvenanceFromAnswers` (ADR-0066 D2, AGE-INV-PROV-1).
 *
 * @throws if `answers` is not an array, if `questionnaire` has no sections, if
 * `options.id` or `options.capturedAt` is missing or blank, or if no answer
 * supplies a business name.
 */
export function buildProfileFromAnswers(
  answers: readonly DiscoveryAnswer[],
  questionnaire: BusinessDiscoveryQuestionnaire,
  options: BuildProfileFromAnswersOptions,
): BusinessDiscoveryProfile {
  return buildProfileAndFieldProvenanceFromAnswers(answers, questionnaire, options).profile;
}

/** The closed signal set this module routes, for the drift guard. */
export const TRANSCRIBED_PROFILE_SIGNALS: readonly ProfileSignal[] = PROFILE_SIGNALS.filter(
  (signal) => PROFILE_SIGNAL_TARGETS[signal].kind !== 'untranscribable',
);
