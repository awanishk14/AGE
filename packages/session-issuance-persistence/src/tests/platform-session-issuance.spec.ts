import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { hashSessionToken, SessionStoreRefusedError } from '@age/session-store';
import type { OperatorSessionScopeRunner } from '@age/session-store-persistence';
import { describe, expect, it } from 'vitest';

import {
  platformOperatorSessionIssuance,
  type OperatorSessionIssuanceDelegate,
} from '../operator-session-issuance';

/**
 * ADR-0083 **D5** — issuing a session that belongs to 🚫 no organization.
 *
 * 🛑 **WHAT THESE PROVE.** That the row is written with `organizationId: null`
 * WRITTEN OUT rather than omitted; that the transaction is fenced by the digest
 * of the very token being issued, so 🚫 a caller cannot issue into a scope it
 * does not hold; that every rule the tenant path enforces — the token shape, the
 * lifetime ceiling, the blank-identifier refusal — is the SAME code here (D3);
 * and that issuance still exists at exactly one module, product-wide.
 *
 * 🚫 Every fixture is obviously fictional (ADR-0053 D3, ADR-0065 D1).
 */

const SRC = join(__dirname, '..');
const REPO_ROOT = join(SRC, '..', '..', '..');
const EXCLUDED_SEGMENTS = new Set(['node_modules', 'dist', '.nx', '.next']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (EXCLUDED_SEGMENTS.has(entry)) return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') || full.endsWith('.tsx') ? [full] : [];
  });
}

const ROOTS = ['packages', 'apps'].map((dir) => join(REPO_ROOT, dir)).filter(existsSync);
const REPO_FILES = ROOTS.flatMap((root) => sourceFiles(root));

const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const TOKEN = 'c'.repeat(64);
const ISSUED_AT = new Date('2026-08-19T10:00:00.000Z');
const EIGHT_HOURS = 8 * 60 * 60;

const request = (overrides: Record<string, unknown> = {}) => ({
  sessionId: 'session-fictional-9',
  accountId: 'operator-fictional-9',
  token: TOKEN,
  issuedAt: ISSUED_AT,
  lifetimeSeconds: EIGHT_HOURS,
  ...overrides,
});

function fakeRunner(
  delegate: OperatorSessionIssuanceDelegate,
  log: string[],
): OperatorSessionScopeRunner<OperatorSessionIssuanceDelegate> {
  return {
    async runInScope(scope, operation) {
      log.push(
        'platformSessionTokenHash' in scope
          ? `platform-scope:${scope.platformSessionTokenHash}`
          : `tenant-scope:${scope.organizationId}`,
      );
      return operation(delegate);
    },
  };
}

describe('platformOperatorSessionIssuance', () => {
  it('🛑 fences on the digest of the token it is issuing, then writes', async () => {
    const log: string[] = [];
    const delegate: OperatorSessionIssuanceDelegate = {
      create: async () => {
        log.push('create');
        return {};
      },
    };

    await platformOperatorSessionIssuance(fakeRunner(delegate, log))(request());

    // 🛑 THE EQUALITY IS THE ARGUMENT. The `WITH CHECK` policy compares the
    // row's `token_hash` against the setting, so a fence opened on any other
    // digest would have the database refuse the insert — loudly.
    expect(log).toEqual([`platform-scope:${hashSessionToken(TOKEN)}`, 'create']);
  });

  it('🚫 never opens a TENANT scope', async () => {
    const log: string[] = [];
    const delegate: OperatorSessionIssuanceDelegate = { create: async () => ({}) };

    await platformOperatorSessionIssuance(fakeRunner(delegate, log))(request());

    expect(log.filter((entry) => entry.startsWith('tenant-scope:'))).toEqual([]);
  });

  it('🛑 writes `organizationId: null` OUT — the key is present, 🚫 not omitted', async () => {
    const written: Record<string, unknown>[] = [];
    const delegate: OperatorSessionIssuanceDelegate = {
      create: async (args) => {
        written.push(args.data as unknown as Record<string, unknown>);
        return {};
      },
    };

    await platformOperatorSessionIssuance(fakeRunner(delegate, []))(request());

    // 🛑 `'organizationId' in data`, 🚫 not `data.organizationId === null` — the
    // two are indistinguishable by value, and `normalizeSessionRecord` refuses
    // the absent key precisely because an unread column is not a principal.
    expect(written).toHaveLength(1);
    expect(Object.keys(written[0] ?? {}).sort()).toEqual([
      'accountId',
      'expiresAt',
      'issuedAt',
      'organizationId',
      'revokedAt',
      'sessionId',
      'tokenHash',
    ]);
    expect(written[0]?.['organizationId']).toBeNull();
  });

  it('🚫 stores the DIGEST and never the token', async () => {
    const written: Record<string, unknown>[] = [];
    const delegate: OperatorSessionIssuanceDelegate = {
      create: async (args) => {
        written.push(args.data as unknown as Record<string, unknown>);
        return {};
      },
    };

    await platformOperatorSessionIssuance(fakeRunner(delegate, []))(request());

    expect(written[0]?.['tokenHash']).toBe(hashSessionToken(TOKEN));
    expect(JSON.stringify(written[0])).not.toContain(TOKEN);
  });

  it('⚠️ returns the session id and its expiry, and 🚫 not the token or the digest', async () => {
    const delegate: OperatorSessionIssuanceDelegate = { create: async () => ({}) };

    const issued = await platformOperatorSessionIssuance(fakeRunner(delegate, []))(request());

    expect(Object.keys(issued).sort()).toEqual(['expiresAt', 'sessionId']);
    expect(issued.expiresAt).toBe('2026-08-19T18:00:00.000Z');
  });

  it.each([
    ['a token that was not minted as 32 bytes of hex', { token: 'not-a-token' }],
    ['a lifetime past the ceiling', { lifetimeSeconds: 60 * 60 * 24 * 365 }],
    ['a blank sessionId', { sessionId: '   ' }],
    ['a blank accountId', { accountId: '' }],
  ])('🛑 refuses %s — by the SAME code the tenant path uses (D3)', async (_label, overrides) => {
    const log: string[] = [];
    const delegate: OperatorSessionIssuanceDelegate = {
      create: async () => {
        log.push('create');
        return {};
      },
    };

    await expect(
      platformOperatorSessionIssuance(fakeRunner(delegate, log))(request(overrides) as never),
    ).rejects.toThrow(SessionStoreRefusedError);

    // 🛑 REFUSED BEFORE A CONNECTION IS OPENED. Nothing was scoped and nothing
    // was written — 🚫 not "written and then rolled back".
    expect(log).toEqual([]);
  });
});

describe('🛑 issuance still exists at EXACTLY ONE module, product-wide', () => {
  it('walked the repository rather than trusting one path', () => {
    expect(REPO_FILES.length).toBeGreaterThan(200);
  });

  it('🚫 no second module calls `.create(` on the session delegate', () => {
    const offenders = REPO_FILES.filter(
      (file) => !file.endsWith('.spec.ts') && !file.endsWith('.test.ts'),
    )
      .filter((file) => /sessions\.create\(/.test(stripComments(readFileSync(file, 'utf8'))))
      .map((file) =>
        file
          .slice(REPO_ROOT.length + 1)
          .split('\\')
          .join('/'),
      );

    // ⚠️ BOTH issuance paths live in the one module ADR-0079 authorized. The
    // platform path is a second SCOPE, 🚫 not a second place a session begins.
    expect(offenders).toEqual([
      'packages/session-issuance-persistence/src/operator-session-issuance.ts',
    ]);
  });

  it('🚫 the platform path cannot fall back to a tenant scope', () => {
    const source = stripComments(readFileSync(join(SRC, 'operator-session-issuance.ts'), 'utf8'));

    for (const banned of [
      'record.organizationId ??',
      "organizationId ?? ''",
      'record.organizationId!',
      'platformSessionTokenHash ??',
    ]) {
      expect(`${banned}: ${source.includes(banned)}`).toBe(`${banned}: false`);
    }

    // ⚠️ And the fence is derived from the record, 🚫 never taken from a caller.
    expect(source).toContain('platformSessionTokenHash: record.tokenHash');
  });
});
