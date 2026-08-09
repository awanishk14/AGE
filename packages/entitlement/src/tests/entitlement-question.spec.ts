import { describe, expect, it } from 'vitest';

import {
  askEntitlement,
  NO_AUTHENTICATION,
  type EntitlementQuestion,
  type EntitlementSubject,
} from '../entitlement-question';
import { acceptVerifiedSession, SessionRefusedError } from '../verified-session';

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

  it('gives the SAME answer for both subject kinds when nobody is authenticated', () => {
    // ⚠️ DELIBERATELY NARROWED IN THE ADR-0061 A3 SLICE, CITING ADR-0062 D1.
    // This test used to assert symmetry unconditionally, pinning "the tenant
    // boundary is undecided" (ADR-0058 §6 Q1). The Product Owner decided it: the
    // tenant is the ORGANIZATION. 🚫 The test was not deleted — the asymmetry it
    // used to forbid is now pinned below, so the choice stays as checkable as
    // its absence was. Without a session the arms are still symmetric, because
    // the answer still does not depend on the subject at all.
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

  it('still offers an unauthenticated authentication, unchanged', () => {
    expect(NO_AUTHENTICATION.kind).toBe('none');
  });
});

const SESSION = acceptVerifiedSession({
  sessionId: 'ses-fictional-1',
  organizationId: 'org-fictional-1',
  accountId: 'acct-fictional-1',
});

function askAsSession(subject: EntitlementSubject): EntitlementQuestion {
  return { authentication: { kind: 'verified-session', session: SESSION }, subject };
}

describe('the entitlement question with a verified session (ADR-0061 A3)', () => {
  it('grants the organization the session speaks for', () => {
    const question = askAsSession({ kind: 'organization', organizationId: 'org-fictional-1' });

    expect(askEntitlement(question).answer).toBe('granted');
  });

  it('DENIES another organization — a decision, not an absence', () => {
    // ⚠️ `denied` is the arm that did not exist before this slice. A denial says
    // AGE looked and said no; `not-established` says AGE cannot look at all.
    const { answer, because } = askEntitlement(
      askAsSession({ kind: 'organization', organizationId: 'org-fictional-2' }),
    );

    expect(answer).toBe('denied');
    expect(because).toContain('after looking');
    expect(because).not.toContain('org-fictional');
  });

  it('names no identifier when it grants either', () => {
    const { because } = askEntitlement(
      askAsSession({ kind: 'organization', organizationId: 'org-fictional-1' }),
    );

    expect(because).not.toContain('org-fictional');
    expect(because).not.toContain('acct-fictional');
    expect(because).not.toContain('ses-fictional');
  });

  it('answers not-established for a client subject, and never denied', () => {
    // 🛑 ADR-0062 D2. The client-to-organization binding is not available here,
    // and 🚫 the inner boundary must never become "the organization query, minus
    // some rows". `not-established` is the honest answer; collapsing it into
    // `denied` would claim AGE had looked.
    const { answer, because } = askEntitlement(
      askAsSession({ kind: 'client', clientId: 'fictional-client-1' }),
    );

    expect(answer).toBe('not-established');
    expect(because).not.toContain('fictional-client-1');
  });

  it('is ASYMMETRIC between the two subject kinds, because ADR-0062 D1 chose', () => {
    // 🛑 The replacement for the old unconditional symmetry assertion. The
    // organization is the tenant; the client is a subject of isolation inside
    // it. If these two ever answer the same way again with a session in hand,
    // either the boundary was quietly un-chosen or the client arm started
    // deriving a tenant it is not allowed to derive.
    const organization = askEntitlement(
      askAsSession({ kind: 'organization', organizationId: 'org-fictional-1' }),
    ).answer;
    const client = askEntitlement(
      askAsSession({ kind: 'client', clientId: 'fictional-client-1' }),
    ).answer;

    expect(organization).not.toBe(client);
  });

  it('grants nothing to a session whose organization is blank', () => {
    // 🚫 Two absences agreeing with each other must never read as authorization.
    expect(() =>
      askEntitlement({
        authentication: {
          kind: 'verified-session',
          session: { sessionId: 's', organizationId: '  ', accountId: 'a' },
        },
        subject: { kind: 'organization', organizationId: '  ' },
      }),
    ).toThrow(SessionRefusedError);
  });
});
