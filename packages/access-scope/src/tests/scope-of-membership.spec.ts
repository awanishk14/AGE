import { describe, expect, it } from 'vitest';

import { scopeForMembership } from '../scope-of-membership';

/**
 * From a stored row to a scope - ADR-0079 §6 slice 4.
 *
 * 🛑 **EVERY REFUSAL HERE IS A CROSS-TENANT REFUSAL IN WAITING.** A row that
 * cannot be expressed as a scope is refused; 🚫 it is never approximated by the
 * nearest scope that parses, because the nearest scope that parses is always the
 * WIDER one.
 */

const ORG = 'org-fictional-nowhere';

const agencyRow = {
  scopeKind: 'agency',
  roleBundle: 'agency-operator',
  organizationId: ORG,
  clientId: null,
} as const;

describe('an agency membership', () => {
  it('becomes an agency scope over the organization the read was scoped to', () => {
    const decision = scopeForMembership(agencyRow, ORG);

    expect(decision.outcome).toBe('scoped');
    if (decision.outcome !== 'scoped') return;
    expect(decision.scope.kind).toBe('agency');
    expect(decision.scope.kind === 'agency' && decision.scope.agencyId).toBe(ORG);
  });

  it('is refused when the row names a different organization than the read', () => {
    // 🛑 THE ROW IS COMPARED, 🚫 NEVER ADOPTED. Adopting it would let whatever
    // produced the row choose the tenant - the chain AGE-INV-SEL-1 forbids.
    const decision = scopeForMembership(
      { ...agencyRow, organizationId: 'org-fictional-elsewhere' },
      ORG,
    );

    expect(decision).toEqual({ outcome: 'refused', reason: 'organization-is-not-the-scope-read' });
  });

  it('is refused when the row carries no organization at all', () => {
    expect(scopeForMembership({ ...agencyRow, organizationId: null }, ORG)).toEqual({
      outcome: 'refused',
      reason: 'missing-organization',
    });
  });

  it('is refused when the bundle does not match the kind', () => {
    expect(scopeForMembership({ ...agencyRow, roleBundle: 'platform-operator' }, ORG)).toEqual({
      outcome: 'refused',
      reason: 'bundle-does-not-match-scope-kind',
    });
  });
});

describe('a client membership', () => {
  const clientRow = {
    scopeKind: 'client',
    roleBundle: 'client-viewer',
    organizationId: ORG,
    clientId: 'client-fictional-acme',
  } as const;

  it('becomes a client scope over exactly that client', () => {
    const decision = scopeForMembership(clientRow, ORG);

    expect(decision.outcome).toBe('scoped');
    if (decision.outcome !== 'scoped') return;
    expect(decision.scope.kind).toBe('client');
    expect(decision.scope.kind === 'client' && decision.scope.clientId).toBe(
      'client-fictional-acme',
    );
  });

  it('is refused when the row names no client', () => {
    // ⚠️ ABSENCE IS NEVER A CONCLUSION. A missing client is 🚫 not "every
    // client of this agency"; that reading is the widening this refusal exists
    // to prevent.
    expect(scopeForMembership({ ...clientRow, clientId: null }, ORG)).toEqual({
      outcome: 'refused',
      reason: 'missing-client',
    });
  });

  it('is refused when the row names a different organization than the read', () => {
    expect(
      scopeForMembership({ ...clientRow, organizationId: 'org-fictional-elsewhere' }, ORG),
    ).toEqual({ outcome: 'refused', reason: 'organization-is-not-the-scope-read' });
  });

  it('is refused when the bundle does not match the kind', () => {
    expect(scopeForMembership({ ...clientRow, roleBundle: 'agency-operator' }, ORG)).toEqual({
      outcome: 'refused',
      reason: 'bundle-does-not-match-scope-kind',
    });
  });
});

/**
 * 🛑 **A ROW CANNOT MINT PLATFORM ACCESS.** `platformScope()` is reachable by
 * NAME only; making it reachable by PARSING is exactly the widening its design
 * exists to prevent, and it is the same refusal sign-in already gives.
 */
describe('a platform membership', () => {
  it('is refused however well-formed the row is', () => {
    expect(
      scopeForMembership(
        {
          scopeKind: 'platform',
          roleBundle: 'platform-operator',
          organizationId: ORG,
          clientId: null,
        },
        ORG,
      ),
    ).toEqual({ outcome: 'refused', reason: 'platform-scope-not-reachable-by-parsing' });
  });
});

describe('a row this product does not understand', () => {
  it.each(['', 'agency ', 'AGENCY', 'superuser', 'admin'])(
    'refuses the scope kind %o rather than falling back to one',
    (scopeKind) => {
      expect(
        scopeForMembership(
          { scopeKind, roleBundle: 'agency-operator', organizationId: ORG, clientId: null },
          ORG,
        ),
      ).toEqual({ outcome: 'refused', reason: 'unknown-scope-kind' });
    },
  );
});

/**
 * ⚠️ A REFUSAL NAMES A POSITION, 🚫 NEVER AN IDENTIFIER (ADR-0054 D3), so it
 * can be written to a log without putting a real organization or client there.
 */
describe('the refusal reasons disclose nothing', () => {
  it('never contains an id from the row it refused', () => {
    const decision = scopeForMembership(
      {
        scopeKind: 'agency',
        roleBundle: 'agency-operator',
        organizationId: 'org-secret-name',
        clientId: 'client-secret-name',
      },
      ORG,
    );

    expect(decision.outcome).toBe('refused');
    if (decision.outcome !== 'refused') return;
    expect(decision.reason).not.toContain('secret');
    expect(decision.reason).not.toContain(ORG);
  });
});
