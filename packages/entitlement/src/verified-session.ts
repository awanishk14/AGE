/**
 * ADR-0061 **A2** — the one thing AGE is allowed to trust about who is asking.
 *
 * 🛑 **A SESSION IS NOT AN `OperatorPrincipal`, AND NEITHER CAN BE BUILT FROM THE
 * OTHER.** ADR-0053 D4 is unchanged and A2 does **not** promote it: an
 * `OperatorPrincipal` is caller-asserted provenance — it records that a named
 * human acted, and it is believed. A `VerifiedSession` is the opposite kind of
 * fact: something outside this process verified it. Allowing a conversion in
 * either direction would let a caller authenticate itself by naming itself,
 * which is the error class ADR-0058 D1 refuses. 🚫 A guard fails the build if the
 * word `OperatorPrincipal` appears anywhere in this package.
 *
 * 🚫 **THIS MODULE VERIFIES NOTHING AND STORES NOTHING.** It is the SHAPE of a
 * verified session and the refusals that make an unusable one impossible to
 * construct. Where sessions live (A2: rows in the deployed Postgres, revocable
 * server-side, 🚫 never a replayable bearer token), how they are issued, and what
 * hashes a credential (A2: argon2id) are each their own slice — and each is an
 * effect, which this package is guarded against performing.
 *
 * Pure: no clock, no id generation, no randomness, no I/O.
 */

/** Raised when something that is not a usable session is offered as one. */
export class SessionRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionRefusedError';
  }
}

/**
 * A session some other component has already verified.
 *
 * ⚠️ **THE TENANT IS THE ORGANIZATION** (ADR-0062 D1). `organizationId` is the
 * scope this session speaks for, and it is the ONLY scope it speaks for — the
 * session does not carry a list of clients, because a list of clients is the
 * inner boundary being expressed as "the organization query, minus some rows",
 * which D2 refuses by name.
 *
 * 🚫 There is no `role`, no `isAdmin` and no permission list here. ADR-0062 D3 —
 * admin is never a bypass — and a flag on the session is precisely how a bypass
 * arrives: the check that reads it is added later, by someone who did not read
 * the ADR.
 */
export interface VerifiedSession {
  /** Identity of the session row itself, so it can be revoked and audited. */
  readonly sessionId: string;
  /** The organization this session speaks for, and no other. */
  readonly organizationId: string;
  /** The account the session was issued to. Recorded; it decides nothing. */
  readonly accountId: string;
}

/**
 * Accept a verified session, refusing anything that is not usable as one.
 *
 * ⚠️ **THE BLANK-IDENTIFIER REFUSAL IS THE LOAD-BEARING ONE.** An empty
 * `organizationId` would compare equal to an empty subject identifier, and the
 * decision below would return `granted` — an authorization produced by two
 * absences agreeing with each other. A missing field is refused here, at the
 * boundary, rather than surviving into a comparison.
 *
 * @throws {SessionRefusedError} naming the FIELD, 🚫 never the value: a refusal
 *         must not carry a real organization's identifier into a log
 *         (ADR-0054 D3).
 */
export function acceptVerifiedSession(session: VerifiedSession): VerifiedSession {
  refuseBlankIdentifiers(session, ['sessionId', 'organizationId', 'accountId']);

  return Object.freeze({
    sessionId: session.sessionId,
    organizationId: session.organizationId,
    accountId: session.accountId,
  });
}

/**
 * The blank-identifier refusal, in **ONE** implementation (ADR-0083 D3).
 *
 * 🛑 **BOTH PRINCIPALS SHARE THIS, AND THAT IS THE POINT.** ADR-0083 option B gives
 * a platform operator its own type precisely so that an absent organization is
 * unrepresentable — 🚫 not so that the refusal it still needs gets copied. A
 * second copy is a second chance for one of them to stop refusing, and the copy
 * that drifts still passes its own test.
 *
 * ⚠️ The field NAME travels into the message; 🚫 the value never does
 * (ADR-0054 D3).
 */
function refuseBlankIdentifiers<TField extends string>(
  subject: Readonly<Record<TField, string>>,
  fields: readonly TField[],
): void {
  for (const field of fields) {
    if (subject[field].trim() === '') {
      throw new SessionRefusedError(
        `A session with a blank ${field} is not a verified session. An absent identifier ` +
          'compares equal to another absent identifier, so accepting one would let two ' +
          'unknowns agree with each other and be read as an authorization.',
      );
    }
  }
}

/**
 * 🛑 **A PRINCIPAL THAT HAS NO ORGANIZATION** — ADR-0083 **D1, option B**.
 *
 * 🛑 **THE ORGANIZATION FIELD DOES NOT EXIST HERE, AND ITS ABSENCE IS THE WHOLE
 * DESIGN.** A platform operator belongs to no organization (ADR-0079;
 * `platformScope()` has taken no arguments since slice 1). The refused option A
 * would have made `VerifiedSession.organizationId` nullable — putting an absent
 * identifier inside the one module whose refusal above exists because two
 * absences comparing equal read as an authorization. 🚫 Here no comparison
 * against an organization can be written at all, correctly or otherwise: there
 * is nothing to compare.
 *
 * 🚫 **IT IS NOT A `VerifiedSession` AND NEITHER CONVERTS INTO THE OTHER.**
 * `VerifiedSession` is left byte-identical by ADR-0083; a widening helper that
 * produced one from the other would undo the decision in a single function.
 *
 * 🚫 No role, no `isAdmin`, no permission list — ADR-0062 D3 is unchanged, and
 * "platform" here is a SCOPE the reader resolves, 🚫 never a bypass the session
 * carries.
 */
export interface VerifiedPlatformSession {
  /** Identity of the session row itself, so it can be revoked and audited. */
  readonly sessionId: string;
  /** The account the session was issued to. Recorded; it decides nothing. */
  readonly accountId: string;
}

/**
 * Accept a verified platform session, refusing anything unusable as one.
 *
 * ⚠️ It refuses through the **same** {@link refuseBlankIdentifiers} the tenant
 * principal uses — over the two fields this principal has. 🚫 There is no
 * organization to check, and 🚫 no default is supplied for one.
 *
 * @throws {SessionRefusedError} naming the FIELD, 🚫 never the value.
 */
export function acceptVerifiedPlatformSession(
  session: VerifiedPlatformSession,
): VerifiedPlatformSession {
  refuseBlankIdentifiers(session, ['sessionId', 'accountId']);

  return Object.freeze({
    sessionId: session.sessionId,
    accountId: session.accountId,
  });
}

declare const AUTHENTICATED_ORGANIZATION: unique symbol;

/**
 * An organization identifier that came from a verified session — ADR-0061 A4.
 *
 * ⚠️ **IT IS A STRING THAT CANNOT BE WRITTEN DOWN.** A plain `string` parameter
 * accepts a URL segment, a form field and a header just as happily as a session
 * does, and a user-supplied path segment is a traversal into another tenant's
 * files. Making the type unforgeable moves "never from a request parameter" from
 * a sentence in an ADR into something the compiler refuses.
 *
 * 🚫 The only honest way to obtain one is `authenticatedOrganizationIdOf`. A cast
 * would defeat it, so a guard asserts no cast to this type exists outside this
 * module.
 */
export type AuthenticatedOrganizationId = string & {
  readonly [AUTHENTICATED_ORGANIZATION]: true;
};

/**
 * The one way to obtain an {@link AuthenticatedOrganizationId}.
 *
 * ⚠️ It re-accepts the session first, so a hand-built object literal with a blank
 * organization cannot become an authenticated identifier by passing through
 * here.
 */
export function authenticatedOrganizationIdOf(
  session: VerifiedSession,
): AuthenticatedOrganizationId {
  return acceptVerifiedSession(session).organizationId as AuthenticatedOrganizationId;
}
