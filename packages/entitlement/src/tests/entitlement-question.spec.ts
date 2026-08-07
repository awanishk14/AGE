import { describe, expect, it } from 'vitest';

import {
  askEntitlement,
  NO_AUTHENTICATION,
  type EntitlementQuestion,
  type EntitlementSubject,
} from '../entitlement-question';

/**
 * Every subject anyone can construct today. ⚠️ Exhaustive over
 * `EntitlementSubject` by type: a new arm is a compile error here, which is what
 * stops a new kind of scope from quietly getting a different answer.
 */
const SUBJECTS: readonly EntitlementSubject[] = [
  { kind: 'organization', organizationId: 'org-fictional-1' },
  { kind: 'client', clientId: 'fictional-client-1' },
];

function ask(subject: EntitlementSubject): EntitlementQuestion {
  return { authentication: NO_AUTHENTICATION, subject };
}

describe('the entitlement question (ADR-0058 D2)', () => {
  it('answers not-established, never true and never false', () => {
    for (const subject of SUBJECTS) {
      expect(askEntitlement(ask(subject)).answer).toBe('not-established');
    }
  });

  it('gives the SAME answer for both subject kinds', () => {
    // 🛑 This is what makes "the tenant boundary is still undecided" checkable.
    // ADR-0058 §6 Q1 is unanswered, and the Product Owner's acceptance did not
    // answer it. If one arm ever answers differently from the other, this
    // module has picked the boundary without an ADR.
    const answers = new Set(SUBJECTS.map((subject) => askEntitlement(ask(subject)).answer));
    expect(answers.size).toBe(1);
  });

  it('does not depend on the subject VALUE either', () => {
    // 🚫 D1's dangerous error: the scope granting access to itself. If the
    // identifier changed the answer, the data would be deciding who may read it.
    const a = askEntitlement(ask({ kind: 'client', clientId: 'fictional-client-1' }));
    const b = askEntitlement(ask({ kind: 'client', clientId: 'fictional-client-2' }));
    expect(a).toEqual(b);
  });

  it('explains itself without naming the subject', () => {
    // 🚫 A refusal message must never carry a real client's or organization's
    // identifier into a log (ADR-0054 D3).
    for (const subject of SUBJECTS) {
      const { because } = askEntitlement(ask(subject));
      expect(because).toContain('no authenticated identity exists');
      const identifier = subject.kind === 'client' ? subject.clientId : subject.organizationId;
      expect(because).not.toContain(identifier);
    }
  });

  it('says loopback is necessary and not sufficient, in those words', () => {
    // ⚠️ ADR-0058 D3 and the `assertLocalDatabaseTarget` rule. 🚫 The reason must
    // never claim the console is unreachable — a proxy or tunnel defeats it.
    const { because } = askEntitlement(ask(SUBJECTS[0]!));
    expect(because).toContain('necessary and not sufficient');
    expect(because).not.toContain('unreachable');
  });

  it('returns a frozen decision', () => {
    expect(Object.isFrozen(askEntitlement(ask(SUBJECTS[0]!)))).toBe(true);
    expect(Object.isFrozen(NO_AUTHENTICATION)).toBe(true);
  });

  it('offers exactly one authentication anyone can construct', () => {
    // ⚠️ The moment a second arm exists, the `switch` in the implementation stops
    // compiling — which is the intended cost of adding authentication.
    expect(NO_AUTHENTICATION.kind).toBe('none');
  });
});
