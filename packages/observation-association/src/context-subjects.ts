import { SectionType } from '@age/bif';
import type {
  ScoredBifContext,
  ScoredBifContextField,
  ScoredBifContextSection,
} from '@age/business-discovery-contracts';
import {
  type ModelledSubject,
  type ObservationSubjectKind,
  OBSERVATION_SUBJECT_KINDS,
  subjectLabelKey,
} from '@age/source-observation';

/**
 * The subjects AGE really models for a business, read out of the BIF projection
 * — ADR-0069 D4, deliverable 4.
 *
 * 🛑 **THIS TRANSCRIBES; IT NEVER INFERS.** A label exists here because the
 * business stated it and the mapper carried it through. 🚫 No stemming, no
 * synonym table, no bucketing of free text, no "reasonable" reading of a value
 * whose shape this module did not expect. A value it cannot read is COUNTED and
 * reported as unreadable — 🚫 never skipped silently, because a silent skip is
 * how a subject disappears and a later refusal becomes inexplicable.
 *
 * 🛑 **THE THREE STATES ARE KEPT APART, AND THAT IS THE POINT OF THIS MODULE**:
 * - `derived` — AGE holds subjects of this kind.
 * - `never-captured` — every section this kind is read from is ABSENT from the
 *   BIF. **AGE HAS NEVER LOOKED.** 🚫 This must never render as "none", "0" or
 *   "no constraints" — absence is a limitation, never negative evidence
 *   (ADR-0026 D4).
 * - `captured-nothing-recorded` — a section IS present and AGE still holds no
 *   subject of this kind. **AGE LOOKED AND FOUND NOTHING RECORDED.**
 *
 * ⚠️ Those last two are the distinction the operator was promised: *a source
 * that did not run* reads differently from *a source that ran and found
 * nothing*. 🚫 Collapsing them into one empty list destroys it, and no downstream
 * screen can reconstruct it.
 *
 * ⚠️ **`constraint` IS `never-captured` ON EVERY BIF AGE PRODUCES TODAY**, and
 * that is truthful, not a defect to patch here: discovery deliberately leaves
 * `profile.constraints` unmapped because bucketing free text into `budget` /
 * `compliance` / `legalConstraints` would be inference. 🚫 Do not "fix" this
 * module by inventing that bucketing — fix it in the mapper, under its own ADR,
 * or leave the honest answer standing.
 *
 * 🚫 **NOTHING HERE MOVES A SCORE, A STATUS OR A COMPLETENESS FIGURE.** It reads
 * a projection that is already read-only and returns a new value.
 *
 * Pure: no clock, no ids, no randomness, no I/O.
 */

/** One place in the BIF a subject kind is read from. ⚠️ NAMED, 🚫 never guessed. */
export interface SubjectSource {
  readonly section: SectionType;
  readonly fieldKey: string;
}

/**
 * Where each kind of subject comes from.
 *
 * 🛑 **THIS TABLE IS THE WHOLE MAPPING, AND IT IS DELIBERATELY LITERAL.** A kind
 * reads named fields of named sections and nothing else. 🚫 Do not add a source
 * because a peer product keeps being refused — a refusal means AGE does not model
 * that subject, and the repair is an intake that captures it, 🚫 not a wider net
 * here.
 */
export const SUBJECT_SOURCES: Readonly<Record<ObservationSubjectKind, readonly SubjectSource[]>> =
  Object.freeze({
    service: Object.freeze([{ section: SectionType.ProductsServices, fieldKey: 'products' }]),
    audience: Object.freeze([
      { section: SectionType.IcpPersonas, fieldKey: 'idealCustomerProfiles' },
      { section: SectionType.IcpPersonas, fieldKey: 'personas' },
    ]),
    geography: Object.freeze([
      { section: SectionType.OrganizationIdentity, fieldKey: 'operatingCountries' },
    ]),
    priority: Object.freeze([{ section: SectionType.VisionStrategy, fieldKey: 'longTermGoals' }]),
    // ⚠️ Named, and reads nothing today on purpose — see the module note.
    constraint: Object.freeze([
      { section: SectionType.Constraints, fieldKey: 'compliance' },
      { section: SectionType.Constraints, fieldKey: 'legalConstraints' },
      { section: SectionType.Constraints, fieldKey: 'technicalConstraints' },
    ]),
  });

export type SubjectSourceState =
  /** 🛑 The section is absent from the BIF. AGE HAS NEVER LOOKED HERE. */
  | 'section-absent'
  /** The section is present; this field is not. AGE looked; nothing is recorded. */
  | 'field-absent'
  /** The field is present and was read. ⚠️ It may still have yielded no label. */
  | 'read';

export interface SubjectSourceReading {
  readonly source: SubjectSource;
  readonly state: SubjectSourceState;
  /** How many labels this source contributed. */
  readonly labelCount: number;
  /**
   * 🛑 Entries present in the field that this module could not read a label from.
   * 🚫 Never zero-by-omission: a reader must be able to see that AGE held
   * something here and could not name it.
   */
  readonly unreadableEntryCount: number;
}

export type SubjectKindState =
  | 'derived'
  /** 🛑 Every source section is absent. 🚫 NEVER render as "none". */
  | 'never-captured'
  /** A section is present and AGE still holds no subject of this kind. */
  | 'captured-nothing-recorded';

export interface SubjectKindDerivation {
  readonly subjectKind: ObservationSubjectKind;
  readonly state: SubjectKindState;
  /** ⚠️ AGE's own labels, deduplicated. 🚫 Never a source system's spelling. */
  readonly subjects: readonly ModelledSubject[];
  /** ⚠️ Every source consulted, INCLUDING the ones that yielded nothing. */
  readonly readings: readonly SubjectSourceReading[];
}

export interface ModelledSubjectDerivation {
  readonly bifId: string;
  /** Every kind, always — 🚫 a kind is never omitted for having no subjects. */
  readonly kinds: readonly SubjectKindDerivation[];
  /** The flat list `assessAdmissibility` takes. ⚠️ May legitimately be empty. */
  readonly subjects: readonly ModelledSubject[];
}

const sectionOf = (
  context: Readonly<ScoredBifContext>,
  section: SectionType,
): ScoredBifContextSection | undefined => context.sections.find((each) => each.type === section);

const fieldOf = (
  section: Readonly<ScoredBifContextSection>,
  fieldKey: string,
): ScoredBifContextField | undefined => section.fields.find((each) => each.key === fieldKey);

/**
 * The ONE reading rule.
 *
 * A plain string is a label. An object is a label only through a non-empty
 * string `name`. 🚫 Everything else is unreadable — 🚫 not `String(entry)`, which
 * would turn `[object Object]` into a subject AGE claims to model.
 */
function labelOf(entry: unknown): string | undefined {
  if (typeof entry === 'string') {
    return entry.trim() === '' ? undefined : entry.trim();
  }

  if (typeof entry === 'object' && entry !== null && 'name' in entry) {
    const { name } = entry as { name: unknown };
    if (typeof name === 'string' && name.trim() !== '') return name.trim();
  }

  return undefined;
}

/** A field value may be one label or a list of them. 🚫 Nothing else is coerced. */
const entriesOf = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : [value]);

function readSource(
  context: Readonly<ScoredBifContext>,
  subjectKind: ObservationSubjectKind,
  source: SubjectSource,
): { readonly reading: SubjectSourceReading; readonly subjects: readonly ModelledSubject[] } {
  const section = sectionOf(context, source.section);
  if (section === undefined) {
    return {
      reading: { source, state: 'section-absent', labelCount: 0, unreadableEntryCount: 0 },
      subjects: [],
    };
  }

  const field = fieldOf(section, source.fieldKey);
  if (field === undefined) {
    return {
      reading: { source, state: 'field-absent', labelCount: 0, unreadableEntryCount: 0 },
      subjects: [],
    };
  }

  const entries = entriesOf(field.value);
  const labels = entries.map(labelOf);
  const subjects = labels
    .filter((label): label is string => label !== undefined)
    .map((label) => ({ subjectKind, label }));

  return {
    reading: {
      source,
      state: 'read',
      labelCount: subjects.length,
      unreadableEntryCount: labels.filter((label) => label === undefined).length,
    },
    subjects,
  };
}

function deriveKind(
  context: Readonly<ScoredBifContext>,
  subjectKind: ObservationSubjectKind,
): SubjectKindDerivation {
  const read = SUBJECT_SOURCES[subjectKind].map((source) =>
    readSource(context, subjectKind, source),
  );
  const readings = read.map((each) => each.reading);

  const seen = new Set<string>();
  const subjects: ModelledSubject[] = [];
  for (const subject of read.flatMap((each) => each.subjects)) {
    const key = subjectLabelKey(subject.label);
    if (seen.has(key)) continue;
    seen.add(key);
    subjects.push(subject);
  }

  // ⚠️ THE ORDER OF THESE TWO TESTS IS LOAD-BEARING. "AGE has never looked" is
  // only true when EVERY source section is absent; one present section means AGE
  // did look, and an empty answer then means something different.
  //
  // 🛑 TODAY NO KIND READS FROM TWO DIFFERENT SECTIONS, so `every` and `some`
  // happen to agree and 🚫 NO TEST CAN TELL THEM APART. `every` is the correct
  // rule, not the convenient one. ⚠️ `SUBJECT_SOURCES spans exactly one section
  // per kind` in the spec fails the moment that stops being true — 🚫 do not
  // relax it; add the case that distinguishes these two branches instead.
  const state: SubjectKindState =
    subjects.length > 0
      ? 'derived'
      : readings.every((reading) => reading.state === 'section-absent')
        ? 'never-captured'
        : 'captured-nothing-recorded';

  return { subjectKind, state, subjects, readings };
}

/**
 * Derives the modelled subjects AGE holds for a business.
 *
 * @param context the read-only BIF projection. 🚫 Never mutated, and 🚫 no score,
 *   status or completeness figure on it is read, copied or reported — relating
 *   an observation to a business must not be able to move what the business
 *   said about itself.
 */
export function deriveModelledSubjects(
  context: Readonly<ScoredBifContext>,
): ModelledSubjectDerivation {
  const kinds = OBSERVATION_SUBJECT_KINDS.map((subjectKind) => deriveKind(context, subjectKind));

  return {
    bifId: context.bifId,
    kinds,
    subjects: kinds.flatMap((kind) => kind.subjects),
  };
}
