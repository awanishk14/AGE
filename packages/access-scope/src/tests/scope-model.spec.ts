import { describe, expect, it } from 'vitest';

import {
  acceptAccessScope,
  AccessScopeRefusedError,
  agencyScope,
  clientScope,
  platformScope,
  type AccessScope,
} from '../access-scope';
import { AccessSubjectRefusedError, decideAccess, type AccessSubject } from '../access-decision';
import {
  acceptCapability,
  CapabilityRefusedError,
  CAPABILITY_ATOMS,
  READING_ATOMS,
  ROLE_BUNDLES,
  WRITING_ATOMS,
  type Capability,
} from '../capabilities';

const AGENCY = 'agency-fictional-one';
const OTHER_AGENCY = 'agency-fictional-two';
const CLIENT = 'client-fictional-one';
const OTHER_CLIENT = 'client-fictional-two';

const SUBJECTS: readonly AccessSubject[] = Object.freeze([
  { agencyId: AGENCY, clientId: null },
  { agencyId: AGENCY, clientId: CLIENT },
  { agencyId: AGENCY, clientId: OTHER_CLIENT },
  { agencyId: OTHER_AGENCY, clientId: null },
  { agencyId: OTHER_AGENCY, clientId: CLIENT },
  { agencyId: OTHER_AGENCY, clientId: OTHER_CLIENT },
]);

const granted = (scope: AccessScope, capability: Capability, subject: AccessSubject) =>
  decideAccess({ scope, capability, subject }).answer === 'granted';

describe('the capability atoms are a total, classified set', () => {
  it('partitions every atom into exactly one of reading or writing', () => {
    // 🛑 The client-read-only rule below is only a rule if this is total: an
    // unclassified atom is neither, and would pass the read-only check unseen.
    const reading = new Set<string>(READING_ATOMS);
    const writing = new Set<string>(WRITING_ATOMS);

    expect(CAPABILITY_ATOMS.length).toBeGreaterThan(0);
    for (const atom of CAPABILITY_ATOMS) {
      expect(reading.has(atom) !== writing.has(atom)).toBe(true);
    }
    expect(reading.size + writing.size).toBe(CAPABILITY_ATOMS.length);
  });

  it('refuses a capability it does not decide about, without echoing it', () => {
    expect(() => acceptCapability('snapshot.delete')).toThrow(CapabilityRefusedError);
    try {
      acceptCapability('snapshot.delete');
    } catch (error) {
      expect((error as Error).message).not.toContain('snapshot.delete');
    }
  });
});

/**
 * 🛑 ADR-0079 §6 slice 1, guard one: A CLIENT PREDICATE CAN NEVER WIDEN.
 *
 * ⚠️ It is asserted by ENUMERATION over every atom and every subject, not by
 * spot-checking the interesting case. A widening added later would be a new
 * combination, and a spot check is exactly what a new combination walks past.
 */
describe('a client scope can never widen', () => {
  const scope = clientScope(AGENCY, CLIENT);

  it('grants only its own agency and its own client, for every atom and every subject', () => {
    let examined = 0;
    for (const capability of CAPABILITY_ATOMS) {
      for (const subject of SUBJECTS) {
        examined += 1;
        if (!granted(scope, capability, subject)) continue;
        expect(subject.agencyId).toBe(AGENCY);
        expect(subject.clientId).toBe(CLIENT);
      }
    }
    expect(examined).toBe(CAPABILITY_ATOMS.length * SUBJECTS.length);
  });

  it('holds no writing atom at all — "clients read-only" (ADR-0079 §0.2)', () => {
    for (const atom of WRITING_ATOMS) {
      expect(ROLE_BUNDLES['client-viewer']).not.toContain(atom);
      expect(granted(scope, atom, { agencyId: AGENCY, clientId: CLIENT })).toBe(false);
    }
  });

  it('never sees the candid rendering (ADR-0079 §4)', () => {
    expect(granted(scope, 'rendering.candid', { agencyId: AGENCY, clientId: CLIENT })).toBe(false);
    expect(granted(scope, 'rendering.client', { agencyId: AGENCY, clientId: CLIENT })).toBe(true);
  });

  it('never reaches the agency above it', () => {
    expect(granted(scope, 'snapshot.read', { agencyId: AGENCY, clientId: null })).toBe(false);
  });

  it('refuses to be constructed with a blank identifier, naming the field only', () => {
    expect(() => clientScope(AGENCY, '  ')).toThrow(AccessScopeRefusedError);
    expect(() => clientScope('', CLIENT)).toThrow(AccessScopeRefusedError);
    try {
      clientScope(AGENCY, '  ');
    } catch (error) {
      expect((error as Error).message).toContain('clientId');
      expect((error as Error).message).not.toContain(AGENCY);
    }
  });
});

/**
 * 🛑 ADR-0079 §6 slice 1, guard two: THE PLATFORM PREDICATE IS REACHABLE ONLY BY
 * NAME.
 */
describe('platform scope is reachable only by name', () => {
  it('is granted when it was produced by platformScope()', () => {
    expect(granted(platformScope(), 'snapshot.read', SUBJECTS[5]!)).toBe(true);
  });

  it('refuses a value that merely says it is platform scope', () => {
    // ⚠️ This is the shape a stored row would parse into. A row is untrusted
    // input, and parsing one must never widen anybody.
    const claimed = {
      kind: 'platform',
      capabilities: [...CAPABILITY_ATOMS],
    } as unknown as AccessScope;

    expect(() => acceptAccessScope(claimed)).toThrow(AccessScopeRefusedError);
    expect(() =>
      decideAccess({ scope: claimed, capability: 'snapshot.read', subject: SUBJECTS[0]! }),
    ).toThrow(AccessScopeRefusedError);
  });

  it('cannot be reached by copying a real platform scope field by field', () => {
    const copied = { ...platformScope() } as AccessScope;
    // ⚠️ **THIS TEST FAILED FIRST, AND THE IMPLEMENTATION WAS WHAT CHANGED.**
    // Object spread copies enumerable SYMBOL keys as readily as string ones, so
    // the witness was preserved by a spread until it was made non-enumerable.
    // The point of the guard is that a scope reassembled field by field — by a
    // mapper, a serializer, a row reader — is not a platform scope.
    expect(() => acceptAccessScope(copied)).toThrow(AccessScopeRefusedError);
  });
});

describe('an agency scope reaches its own agency and no other', () => {
  const scope = agencyScope(AGENCY);

  it('grants only subjects within its own agency, for every atom', () => {
    for (const capability of CAPABILITY_ATOMS) {
      for (const subject of SUBJECTS) {
        if (!granted(scope, capability, subject)) continue;
        expect(subject.agencyId).toBe(AGENCY);
      }
    }
  });

  it('does not hold the platform-only atoms', () => {
    expect(granted(scope, 'agency.create', { agencyId: AGENCY, clientId: null })).toBe(false);
    expect(granted(scope, 'account.provision', { agencyId: AGENCY, clientId: null })).toBe(false);
  });
});

describe('subjects are accepted, not assumed', () => {
  it('refuses a blank subject rather than reading it as "any"', () => {
    for (const subject of [
      { agencyId: '  ', clientId: null },
      { agencyId: AGENCY, clientId: '  ' },
    ] as AccessSubject[]) {
      expect(() =>
        decideAccess({ scope: agencyScope(AGENCY), capability: 'snapshot.read', subject }),
      ).toThrow(AccessSubjectRefusedError);
    }
  });

  it('refuses without naming an identifier', () => {
    const decision = decideAccess({
      scope: agencyScope(AGENCY),
      capability: 'snapshot.read',
      subject: { agencyId: OTHER_AGENCY, clientId: null },
    });
    expect(decision.answer).toBe('refused');
    expect(decision.because).not.toContain(OTHER_AGENCY);
    expect(decision.because).not.toContain(AGENCY);
  });
});
