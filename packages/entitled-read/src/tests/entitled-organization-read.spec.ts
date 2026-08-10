import { ClientContext } from '@age/capability-kit';
import {
  authenticatedOrganizationIdOf,
  NO_AUTHENTICATION,
  SessionRefusedError,
  type VerifiedSession,
} from '@age/entitlement';
import {
  acceptSessionScopedClientContext,
  TenantIsolationRefusedError,
} from '@age/tenant-isolation';
import { describe, expect, it } from 'vitest';

import {
  EntitlementRefusedError,
  readWithinEntitlement,
  type EntitledReadInput,
} from '../entitled-organization-read';

const SESSION: VerifiedSession = Object.freeze({
  sessionId: 'session-1',
  organizationId: 'org-acme',
  accountId: 'account-1',
});

/**
 * ⚠️ THIS FUNCTION IS THE WHOLE PROOF (ADR-0068 §0.1d). It stands where the
 * query would be built, and it THROWS if anything reaches it — so a refusal
 * raised too late fails loudly instead of looking identical to one raised in
 * time.
 *
 * 🚫 It is not a counter inspected afterwards. A counter records that the query
 * was built; this makes building it impossible to survive.
 */
function queryThatMustNeverBeBuilt(): never {
  throw new Error(
    'THE QUERY WAS BUILT. The entitlement decision must be raised before this is reached.',
  );
}

function inputFor(
  requestedOrganizationId: string,
  authentication: EntitledReadInput<never>['authentication'],
): EntitledReadInput<never> {
  return {
    authentication,
    requested: new ClientContext('client-1', requestedOrganizationId),
    openQuery: queryThatMustNeverBeBuilt,
  };
}

function refusalFrom(input: EntitledReadInput<never>): EntitlementRefusedError {
  try {
    readWithinEntitlement(input);
  } catch (error) {
    return error as EntitlementRefusedError;
  }

  throw new Error('Expected a refusal, and none was raised.');
}

describe('a denial is raised before a query exists', () => {
  const CROSS_TENANT = inputFor('org-other', {
    kind: 'verified-session',
    session: SESSION,
  });

  it('refuses a session speaking for another organization, and builds nothing', () => {
    // ⚠️ If the query were built first, the spy's own error would surface here
    // instead of the refusal — so this assertion is about ORDER, not merely
    // about refusing.
    expect(() => readWithinEntitlement(CROSS_TENANT)).toThrow(EntitlementRefusedError);
  });

  it('carries the decision as `denied`', () => {
    expect(refusalFrom(CROSS_TENANT).answer).toBe('denied');
  });

  it('🚫 names no organization and no client in its message', () => {
    // ADR-0054 D3 — a refusal must not carry a real tenant into a log.
    const message = refusalFrom(CROSS_TENANT).message;

    expect(message).not.toContain('org-other');
    expect(message).not.toContain('org-acme');
    expect(message).not.toContain('client-1');
  });

  it('🛑 an empty result set is NOT how a denial is expressed', () => {
    // ADR-0068 §4: [] is indistinguishable from a tenant that has no rows.
    let returned: unknown = 'nothing was returned';
    try {
      returned = readWithinEntitlement(CROSS_TENANT);
    } catch {
      returned = 'a refusal was raised';
    }

    expect(returned).toBe('a refusal was raised');
  });
});

describe('not-established is its own answer and 🚫 never a denial', () => {
  it('refuses an unauthenticated read without building a query', () => {
    const refusal = refusalFrom(inputFor('org-acme', NO_AUTHENTICATION));

    // 🛑 THE DISTINCTION THAT MAKES THE REFUSAL SAFE (ADR-0058 D2).
    // `not-established` means AGE has no way to look; `denied` is a decision
    // made after looking.
    expect(refusal.answer).toBe('not-established');
    expect(refusal.answer).not.toBe('denied');
  });

  it('does not depend on the subject — 🚫 the scope never grants itself access', () => {
    // ADR-0058 D1: without a session the answer is the same whichever
    // organization is named, including the one a session would have matched.
    const answers = ['org-acme', 'org-other', 'org-unknown'].map(
      (organizationId) => refusalFrom(inputFor(organizationId, NO_AUTHENTICATION)).answer,
    );

    expect(answers).toEqual(['not-established', 'not-established', 'not-established']);
  });

  it('explains itself without naming a subject', () => {
    const refusal = refusalFrom(inputFor('org-acme', NO_AUTHENTICATION));

    expect(refusal.because).toContain('no authenticated identity exists');
    expect(refusal.because).not.toContain('org-acme');
  });
});

describe('a granted read reaches the query, and only then', () => {
  it('builds the query exactly once, within the session’s own tenant', () => {
    const built: ClientContext[] = [];

    const rows = readWithinEntitlement<readonly string[]>({
      authentication: { kind: 'verified-session', session: SESSION },
      requested: new ClientContext('client-1', 'org-acme'),
      openQuery: (context) => {
        built.push(context);
        return ['a-row'];
      },
    });

    expect(rows).toEqual(['a-row']);
    expect(built).toHaveLength(1);
    expect(built[0]?.organizationId).toBe('org-acme');
    expect(built[0]?.clientId).toBe('client-1');
  });

  it('hands the query a context rebuilt from the session, 🚫 not the caller’s object', () => {
    const requested = new ClientContext('client-1', 'org-acme');
    let received: ClientContext | undefined;

    readWithinEntitlement<null>({
      authentication: { kind: 'verified-session', session: SESSION },
      requested,
      openQuery: (context) => {
        received = context;
        return null;
      },
    });

    // ⚠️ A caller-held object can be mutated after the check passed.
    expect(received).not.toBe(requested);
  });

  it('🚫 returns what the query returned, unchanged — including nothing', () => {
    // ⚠️ A scoped query that finds nothing is the ordinary answer, and this
    // path must not dress it as a refusal (`acceptRowWithinTenant`'s rule).
    const rows = readWithinEntitlement<readonly string[]>({
      authentication: { kind: 'verified-session', session: SESSION },
      requested: new ClientContext('client-1', 'org-acme'),
      openQuery: () => [],
    });

    expect(rows).toEqual([]);
  });
});

describe('the two checks are not interchangeable', () => {
  it('a blank organization is refused before any answer is produced', () => {
    // ⚠️ An empty session organizationId would compare equal to an empty
    // requested organization and be read as `granted` — two absences agreeing.
    expect(() =>
      readWithinEntitlement<never>({
        authentication: {
          kind: 'verified-session',
          session: { sessionId: 's', organizationId: '', accountId: 'a' },
        },
        requested: new ClientContext('client-1', ''),
        openQuery: queryThatMustNeverBeBuilt,
      }),
    ).toThrow(SessionRefusedError);
  });

  it('a blank client is refused by tenant isolation, not by entitlement', () => {
    // ⚠️ The entitlement question answers "may this session act on this
    // organization" and says nothing at all about the client. 🚫 Removing
    // either check must fail a test, so both are exercised here.
    expect(() =>
      readWithinEntitlement<never>({
        authentication: { kind: 'verified-session', session: SESSION },
        requested: new ClientContext('   ', 'org-acme'),
        openQuery: queryThatMustNeverBeBuilt,
      }),
    ).toThrow(TenantIsolationRefusedError);
  });

  it('tenant isolation refuses a cross-tenant context on its own', () => {
    // Reached directly, past the entitlement gate, to prove isolation is a
    // SECOND check and 🚫 not a consequence of the first.
    expect(() =>
      acceptSessionScopedClientContext({
        requested: new ClientContext('client-1', 'org-other'),
        organizationId: authenticatedOrganizationIdOf(SESSION),
      }),
    ).toThrow(TenantIsolationRefusedError);
  });
});
