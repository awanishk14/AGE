import {
  InMemoryScoredBifSnapshotRepository,
  produceScoredBifContext,
  SAMPLE_BUSINESS_DISCOVERY_PROFILE,
  toScoredBifSnapshot,
  type ScoredBifContext,
} from '@age/business-discovery-contracts';
import { ClientContext } from '@age/capability-kit';
import {
  authenticatedOrganizationIdOf,
  type AuthenticatedOrganizationId,
  type VerifiedSession,
} from '@age/entitlement';
import { ClientContextBoundScoredBifSnapshotRepository } from '@age/scored-bif-snapshot-persistence';
import { describe, expect, it } from 'vitest';

import {
  acceptRowWithinTenant,
  acceptSessionScopedClientContext,
  assertRowsWithinTenant,
  TenantIsolationRefusedError,
} from '../tenant-isolation';

/**
 * ⚠️ **A6 ITEM 5 IN ITS OWN WORDS: "TENANT ISOLATION TESTED — ORGANIZATION A
 * CANNOT READ ORGANIZATION B'S ROW", and 🛑 "the test must not be written
 * against RLS as though it were the boundary."**
 *
 * So the two-organization tests below run the REAL read path — the shipped
 * `ClientContextBoundScoredBifSnapshotRepository` over the shipped in-memory
 * port — with no database anywhere near them. If isolation here depended on a
 * policy, these tests would pass while the deployed system leaked.
 */

function sessionFor(organizationId: string): VerifiedSession {
  return {
    sessionId: 'session-1',
    organizationId,
    accountId: 'account-1',
    verifiedAt: '2026-08-09T10:00:00.000Z',
  } as VerifiedSession;
}

function organization(id: string): AuthenticatedOrganizationId {
  return authenticatedOrganizationIdOf(sessionFor(id));
}

const ORG_A = organization('org-alpha');
const ORG_B = organization('org-beta');

function contextFor(): ScoredBifContext {
  return produceScoredBifContext(SAMPLE_BUSINESS_DISCOVERY_PROFILE, {
    organizationId: 'org-beta',
    constructedAt: new Date('2026-07-15T09:30:00.000Z'),
    changedBy: 'analyst@example.com',
  }).context;
}

describe("organization A cannot read organization B's row", () => {
  const context = contextFor();

  async function storeWithBetaRow() {
    const port = new InMemoryScoredBifSnapshotRepository();
    await port.append({
      clientId: 'client-beta',
      organizationId: 'org-beta',
      bifId: context.bifId,
      snapshotId: 'snap-beta',
      capturedAt: '2026-07-15T09:30:00.000Z',
      snapshot: toScoredBifSnapshot(context),
    });
    return port;
  }

  it("refuses to build a beta-scoped context from alpha's session", () => {
    // 🛑 The attempt stops here — before a query exists, let alone a policy.
    expect(() =>
      acceptSessionScopedClientContext({
        requested: new ClientContext('client-beta', 'org-beta'),
        organizationId: ORG_A,
      }),
    ).toThrow(TenantIsolationRefusedError);
  });

  it("finds nothing when alpha's own session scopes the read", async () => {
    const port = await storeWithBetaRow();
    const scope = acceptSessionScopedClientContext({
      requested: new ClientContext('client-beta', 'org-alpha'),
      organizationId: ORG_A,
    });
    const repository = new ClientContextBoundScoredBifSnapshotRepository(scope, port);

    // ⚠️ The row exists in the store. It is unreachable because the ids the
    // query is built from came from the session, not from the request.
    expect(
      await repository.findBySnapshotId({ bifId: context.bifId, snapshotId: 'snap-beta' }),
    ).toBeNull();
    expect(await repository.listSeries({ bifId: context.bifId })).toEqual([]);
    expect(await repository.findLatest({ bifId: context.bifId })).toBeNull();
  });

  it("beta's own session reads beta's row, so the test is not passing by accident", async () => {
    const port = await storeWithBetaRow();
    const scope = acceptSessionScopedClientContext({
      requested: new ClientContext('client-beta', 'org-beta'),
      organizationId: ORG_B,
    });
    const repository = new ClientContextBoundScoredBifSnapshotRepository(scope, port);

    const found = await repository.findBySnapshotId({
      bifId: context.bifId,
      snapshotId: 'snap-beta',
    });

    expect(found?.snapshotId).toBe('snap-beta');
  });
});

describe('a context is admitted only when the session says so', () => {
  it("returns a context carrying the session's organization", () => {
    const accepted = acceptSessionScopedClientContext({
      requested: new ClientContext('client-alpha', 'org-alpha'),
      organizationId: ORG_A,
    });

    expect(accepted.organizationId).toBe('org-alpha');
    expect(accepted.clientId).toBe('client-alpha');
  });

  it('returns a new object, never the caller-held one', () => {
    const requested = new ClientContext('client-alpha', 'org-alpha');

    expect(acceptSessionScopedClientContext({ requested, organizationId: ORG_A })).not.toBe(
      requested,
    );
  });

  it.each([
    ['another organization', new ClientContext('client-alpha', 'org-beta')],
    ['a blank organization', new ClientContext('client-alpha', '')],
    ['a blank client', new ClientContext('   ', 'org-alpha')],
    ['a near-miss organization', new ClientContext('client-alpha', 'org-alpha ')],
    ['a differently cased organization', new ClientContext('client-alpha', 'ORG-ALPHA')],
  ])('refuses %s', (_case, requested) => {
    expect(() => acceptSessionScopedClientContext({ requested, organizationId: ORG_A })).toThrow(
      TenantIsolationRefusedError,
    );
  });

  it('names no organization in the refusal', () => {
    // 🚫 One of the two is somebody else's tenant, and a refusal that prints it
    // has put a real tenant in a log.
    try {
      acceptSessionScopedClientContext({
        requested: new ClientContext('client-beta', 'org-beta'),
        organizationId: ORG_A,
      });
      expect.unreachable('a cross-tenant context must be refused');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain('org-beta');
      expect(message).not.toContain('org-alpha');
      expect(message).not.toContain('client-beta');
    }
  });

  it('refuses rather than narrows', () => {
    // 🚫 If this ever returned an alpha-scoped context instead of throwing, a
    // cross-tenant attempt would become an ordinary successful read.
    let returned: ClientContext | undefined;
    try {
      returned = acceptSessionScopedClientContext({
        requested: new ClientContext('client-beta', 'org-beta'),
        organizationId: ORG_A,
      });
    } catch {
      returned = undefined;
    }

    expect(returned).toBeUndefined();
  });
});

describe('rows are checked on the way back out', () => {
  const alphaRow = { clientId: 'client-alpha', organizationId: 'org-alpha' };
  const betaRow = { clientId: 'client-beta', organizationId: 'org-beta' };

  it('admits the tenant’s own rows', () => {
    expect(() => assertRowsWithinTenant([alphaRow, alphaRow], ORG_A, 'snapshot')).not.toThrow();
  });

  it('admits an empty result', () => {
    // ⚠️ Nothing found is the ordinary answer, 🚫 never an error.
    expect(() => assertRowsWithinTenant([], ORG_A, 'snapshot')).not.toThrow();
  });

  it('refuses a foreign row among own rows', () => {
    expect(() => assertRowsWithinTenant([alphaRow, betaRow], ORG_A, 'snapshot')).toThrow(
      TenantIsolationRefusedError,
    );
  });

  it('discards the whole result rather than filtering it', () => {
    // 🚫 Filtering would show the caller a plausible, quietly wrong answer and
    // leave the defect below the query in place.
    try {
      assertRowsWithinTenant([alphaRow, betaRow], ORG_A, 'snapshot series');
      expect.unreachable('a foreign row must be refused');
    } catch (error) {
      expect((error as Error).message).toContain('snapshot series');
      expect((error as Error).message).not.toContain('org-beta');
    }
  });

  it('requires a subject, so a refusal can be acted on', () => {
    expect(() => assertRowsWithinTenant([], ORG_A, '  ')).toThrow(TenantIsolationRefusedError);
  });

  it('passes null through as the ordinary answer', () => {
    expect(acceptRowWithinTenant(null, ORG_A, 'snapshot')).toBeNull();
  });

  it('returns the row itself when it belongs to the tenant', () => {
    expect(acceptRowWithinTenant(alphaRow, ORG_A, 'snapshot')).toBe(alphaRow);
  });

  it('refuses a single foreign row', () => {
    expect(() => acceptRowWithinTenant(betaRow, ORG_A, 'snapshot')).toThrow(
      TenantIsolationRefusedError,
    );
  });
});
