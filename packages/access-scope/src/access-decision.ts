/**
 * The composed predicate — ADR-0079 §2, slice 1 of §6.
 *
 * 🛑 **THE PLATFORM ARM IS COMPOSED ON TOP, 🚫 NEVER INSIDE THE MEMBERSHIP
 * ARMS.** The agency and client arms answer one question and one only: does this
 * scope reach this subject? They do not know that platform scope exists, so
 * there is no branch inside them for a super admin to arrive through — and no
 * later edit can turn "is this my client" into "is this my client, or am I an
 * admin". That is the property adopted from the peer product (ADR-0079 §2), and
 * it is the reason its shape was worth adopting.
 *
 * 🚫 **A SCOPE NEVER GRANTS ITSELF.** Every arm compares the scope with the
 * SUBJECT the caller named; nothing here reads a role name, an `isAdmin` flag or
 * a bundle. ADR-0062 D3 — admin is never a bypass — is enforceable only while
 * that stays true.
 *
 * ⚠️ **THIS DECIDES REACH, 🚫 NOT WHETHER A ROW EXISTS.** A `granted` answer
 * says the scope may see that subject IF it is there; it says nothing about
 * whether it is. Absence is never a conclusion.
 *
 * Pure: no clock, no ids, no randomness, no I/O.
 */

import { acceptAccessScope, type AccessScope } from './access-scope';
import { acceptCapability, type Capability } from './capabilities';

/**
 * 🚫 **TWO ANSWERS, AND NEITHER IS A BOOLEAN.** A `refused` carries why, because
 * a bare `false` is the thing people add a bypass to get past.
 *
 * ⚠️ There is no `not-established` arm here, and that is deliberate rather than
 * an omission: this predicate is only ever asked once a scope EXISTS. Whether
 * anyone is authenticated at all is `askEntitlement`'s question, and it keeps
 * its three-valued answer.
 */
export type AccessAnswer = 'granted' | 'refused';

/** What is being acted on. `clientId: null` means the agency itself. */
export interface AccessSubject {
  readonly agencyId: string;
  readonly clientId: string | null;
}

export interface AccessRequest {
  readonly scope: AccessScope;
  readonly capability: Capability;
  readonly subject: AccessSubject;
}

export interface AccessDecision {
  readonly answer: AccessAnswer;
  /**
   * Why, in words an operator can be shown.
   *
   * 🚫 It names a POSITION or a RELATIONSHIP and never an identifier: a refusal
   * that prints one has put a real agency or client into a log (ADR-0054 D3).
   */
  readonly because: string;
}

const GRANTED_PLATFORM = 'Platform scope reaches every agency and every client, by design.';

const GRANTED_AGENCY = 'The scope speaks for the agency this subject belongs to.';

const GRANTED_CLIENT = 'The scope speaks for exactly this client, beneath exactly this agency.';

const REFUSED_CAPABILITY =
  'Refused: this scope does not hold that capability. It is refused rather than narrowed to ' +
  'something adjacent, because a partially honoured request is the hardest kind to notice.';

const REFUSED_OTHER_AGENCY =
  'Refused: that subject belongs to a different agency. It is refused rather than filtered ' +
  'down to nothing, because an empty result is indistinguishable from an ordinary one and ' +
  'nobody would ever hear that a boundary was tested.';

const REFUSED_OTHER_CLIENT =
  'Refused: a client scope reaches exactly one client and this subject is not it. There is no ' +
  'widening arm — not a wildcard, not a blank, not a parent.';

const REFUSED_AGENCY_LEVEL_SUBJECT =
  'Refused: a client scope reaches a client, never the agency above it. Reading the agency ' +
  'would mean reading its other clients in aggregate, which is the same crossing by a longer ' +
  'route.';

const granted = (because: string): AccessDecision =>
  Object.freeze({ answer: 'granted' as AccessAnswer, because });

const refused = (because: string): AccessDecision =>
  Object.freeze({ answer: 'refused' as AccessAnswer, because });

/**
 * Does this scope reach this subject, for this capability?
 *
 * 🚫 **THERE IS NO `default` ARM, NO `allowAll`, NO SYSTEM SCOPE AND NO DEV-MODE
 * BYPASS.** Adding a fourth scope kind must break the build.
 *
 * ⚠️ **THE CAPABILITY IS CHECKED FIRST, IDENTICALLY FOR EVERY SCOPE KIND.**
 * Checking it inside each arm is how one arm ends up with a slightly different
 * rule that nobody compares against the others.
 */
export function decideAccess(request: AccessRequest): AccessDecision {
  // ⚠️ Both are re-accepted at the point of USE. A caller can build either
  // object literal itself, and a blank identifier would otherwise compare equal
  // to a blank subject.
  const scope = acceptAccessScope(request.scope);
  const capability = acceptCapability(request.capability);
  const subject = acceptSubject(request.subject);

  if (!scope.capabilities.includes(capability)) {
    return refused(REFUSED_CAPABILITY);
  }

  switch (scope.kind) {
    // 🛑 The platform arm is HERE, alongside the others and composed on top of
    // them — 🚫 never reached from inside one.
    case 'platform':
      return granted(GRANTED_PLATFORM);
    case 'agency':
      return scope.agencyId === subject.agencyId
        ? granted(GRANTED_AGENCY)
        : refused(REFUSED_OTHER_AGENCY);
    case 'client': {
      if (scope.agencyId !== subject.agencyId) return refused(REFUSED_OTHER_AGENCY);
      if (subject.clientId === null) return refused(REFUSED_AGENCY_LEVEL_SUBJECT);
      return scope.clientId === subject.clientId
        ? granted(GRANTED_CLIENT)
        : refused(REFUSED_OTHER_CLIENT);
    }
  }
}

/** Raised when something that is not a usable subject is offered as one. */
export class AccessSubjectRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccessSubjectRefusedError';
  }
}

/**
 * ⚠️ A blank subject identifier is REFUSED, 🚫 never treated as "any". `null` is
 * the agency itself and is a different fact from an empty string, which is
 * simply a field somebody forgot to fill in.
 */
function acceptSubject(subject: AccessSubject): AccessSubject {
  if (typeof subject.agencyId !== 'string' || subject.agencyId.trim() === '') {
    throw new AccessSubjectRefusedError(
      'A subject with a blank agencyId is not a subject. A blank identifier is not "any ' +
        'agency" — there is no such subject.',
    );
  }

  if (subject.clientId !== null && subject.clientId.trim() === '') {
    throw new AccessSubjectRefusedError(
      'A subject with a blank clientId is not a subject. A blank identifier is not "all ' +
        'clients" — null means the agency itself, and a blank means a field was forgotten.',
    );
  }

  return subject;
}
