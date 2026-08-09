/**
 * ADR-0061 **A6 item 6** — audit: who logged in, and what was read, retrievable.
 *
 * ⚠️ **"RETRIEVABLE" IS THE WHOLE REQUIREMENT.** Lines in a log file that nobody
 * can query are not an audit trail; they are exhaust. So an entry is a
 * structured record with the fields a question is actually asked about — who,
 * when, from where, what, and whether it succeeded — 🚫 not a formatted string
 * somebody greps later.
 *
 * 🛑 **A FAILURE IS RECORDED AS LOUDLY AS A SUCCESS.** An audit that records only
 * successful sign-ins is an audit that cannot see an attack in progress: the
 * thousand refusals before the one success are the whole story, and they are the
 * part that gets dropped when "record the login" is read as "record the login
 * that worked".
 *
 * 🚫 **AN ENTRY NEVER CARRIES A SECRET AND NEVER CARRIES THE DATA.** No password,
 * no token, no token hash, no session token, and 🚫 no copy of what was read. An
 * audit trail that contains the answers is a second, less guarded copy of the
 * database — and it is the copy people export to a spreadsheet. It names WHAT was
 * read, by identifier, 🚫 never its contents.
 *
 * 🚫 **THERE IS NO WAY TO TURN IT OFF.** No `enabled`, no `level`, no sampling: a
 * recorder with a switch is a recorder that is off during the incident. There is
 * likewise no redaction, edit or deletion — an entry that can be rewritten proves
 * nothing about what happened.
 *
 * ⚠️ **AN AUDIT READ IS ITSELF A TENANT-SCOPED READ.** The trail is not a place
 * where the tenants are mixed for convenience; A6 item 5 applies to it exactly as
 * it applies to the rows it describes.
 *
 * Pure: the instant and every identifier arrive as parameters. 🚫 It writes
 * nothing, stores nothing and reads no clock — where these entries are kept is
 * the deployment composition's slice.
 */

/** Refusal raised when an entry cannot be constructed honestly. */
export class AuditEntryRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuditEntryRefusedError';
  }
}

/**
 * ⚠️ **A CLOSED SET, 🚫 NOT A FREE-TEXT `action` STRING.** A free-text action is
 * how an audit trail becomes unqueryable one careless call site at a time.
 */
export const AUDIT_EVENTS = Object.freeze([
  'authentication-succeeded',
  'authentication-failed',
  'session-revoked',
  'record-read',
] as const);

export type AuditEvent = (typeof AUDIT_EVENTS)[number];

/**
 * Who acted, as far as the system honestly knows.
 *
 * ⚠️ On a failed authentication there is no account — the subject is the key
 * that was *offered*, which is not evidence that it exists. The two are separate
 * fields so that nothing downstream can mistake one for the other.
 */
export interface AuditActor {
  /** The organization the action was performed within, if a session established one. */
  readonly organizationId: string | null;
  /** The account, ONLY when authentication succeeded. 🚫 Never guessed. */
  readonly accountId: string | null;
  /** The subject key that was offered. ⚠️ Opaque, and 🚫 never proof of existence. */
  readonly offeredSubjectKey: string | null;
  /** The origin, as the deployment observed it. 🚫 Never as the client claimed it. */
  readonly sourceKey: string;
}

/** What was read, by name and identifier — 🚫 never by content. */
export interface AuditTarget {
  /** The kind of thing, e.g. `scored-bif-snapshot`. */
  readonly recordType: string;
  /** Its identifier within the tenant. */
  readonly recordId: string;
}

export interface AuditEntry {
  readonly entryId: string;
  readonly event: AuditEvent;
  readonly occurredAt: string;
  readonly actor: AuditActor;
  /** Present only for a `record-read`. `null` says "this event has no target". */
  readonly target: AuditTarget | null;
}

/**
 * ⚠️ **BANNED FIELD NAMES, CHECKED AT RUNTIME.** The type system stops these at
 * the call sites that exist today; this stops the one written next year against
 * a widened interface, and it is what makes "an entry never carries a secret"
 * a property of the data rather than a promise in a comment.
 */
const FORBIDDEN_FIELDS = Object.freeze([
  'password',
  'token',
  'tokenhash',
  'secret',
  'credential',
  'cookie',
  'snapshot',
  'payload',
  'answers',
  'contents',
]);

function assertPresent(value: string, field: string): void {
  if (value.trim() === '') {
    throw new AuditEntryRefusedError(
      `An audit entry needs its ${field}. A blank one produces a record that says something ` +
        'happened without saying what, which is worse than no record: it looks like coverage.',
    );
  }
}

function assertCarriesNoSecret(subject: Record<string, unknown>, where: string): void {
  for (const key of Object.keys(subject)) {
    const flattened = key.toLowerCase().replace(/[^a-z]/g, '');
    if (FORBIDDEN_FIELDS.includes(flattened)) {
      // 🚫 Names the FIELD, never the value: a refusal that echoes what it
      // refused has written the secret into the log it was protecting.
      throw new AuditEntryRefusedError(
        `Refused: the ${where} of an audit entry carries a field named '${key}', and an audit ` +
          'trail may not hold a secret or a copy of the data. Record what was read, by ' +
          'identifier — 🚫 never what it said.',
      );
    }
  }
}

export interface RecordAuditEntryInput {
  readonly entryId: string;
  readonly event: AuditEvent;
  /** ISO-8601 UTC. ⚠️ Caller-supplied, so this module reads no clock. */
  readonly occurredAt: string;
  readonly actor: AuditActor;
  readonly target?: AuditTarget | null;
}

/**
 * Builds one audit entry.
 *
 * @throws {AuditEntryRefusedError} if the event is unknown, the instant is not a
 *         readable ISO-8601 UTC instant, a required identifier is blank, a
 *         `record-read` names no target, an event that is not a read names one,
 *         or any field carries a secret or a copy of the data.
 */
export function recordAuditEntry(input: RecordAuditEntryInput): AuditEntry {
  const { entryId, event, occurredAt, actor } = input;
  const target = input.target ?? null;

  assertPresent(entryId, 'identifier');
  assertPresent(actor.sourceKey, "actor's source");

  if (!AUDIT_EVENTS.includes(event)) {
    throw new AuditEntryRefusedError(
      `Refused: '${String(event)}' is not one of the audit events. The set is closed on purpose ` +
        '— a free-text action is how a trail stops being answerable.',
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(occurredAt)) {
    throw new AuditEntryRefusedError(
      'An audit entry needs a canonical ISO-8601 UTC instant. A local time in a trail read ' +
        'somewhere else is a fact about nothing.',
    );
  }

  if (event === 'record-read' && target === null) {
    throw new AuditEntryRefusedError(
      'A read must name what was read. "Something was read" is not an audit trail.',
    );
  }

  if (event !== 'record-read' && target !== null) {
    // ⚠️ A sign-in that names a record is a sign-in whose call site is confused,
    // and a confused entry is worse than a missing one.
    throw new AuditEntryRefusedError(
      'Only a read names a record. An authentication event that carries one was assembled by ' +
        'a call site that has mixed two things up.',
    );
  }

  if (event === 'authentication-failed' && actor.accountId !== null) {
    // 🛑 A failed authentication has not established WHO. Naming an account here
    // records as fact the very thing that was not proven.
    throw new AuditEntryRefusedError(
      'A failed authentication names no account. It proved nothing about who was at the other ' +
        'end, and recording an account anyway turns a guess into evidence.',
    );
  }

  assertCarriesNoSecret(actor as unknown as Record<string, unknown>, 'actor');
  if (target !== null) {
    assertPresent(target.recordType, "target's type");
    assertPresent(target.recordId, "target's identifier");
    assertCarriesNoSecret(target as unknown as Record<string, unknown>, 'target');
  }

  return Object.freeze({
    entryId,
    event,
    occurredAt,
    actor: Object.freeze({ ...actor }),
    target: target === null ? null : Object.freeze({ ...target }),
  });
}
