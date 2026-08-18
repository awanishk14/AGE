import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * The session store's SHAPE, asserted without a database.
 *
 * WHY THIS EXISTS ALONGSIDE THE LIVE SUITE. `operator-sessions-rls.db.spec.ts`
 * proves the policies behave, but it only runs in the path-gated live job. The
 * facts below are ones a future migration could quietly reverse — a `DEFAULT
 * now()`, an `isAdmin` column, a GRANT of INSERT "just so provisioning works" —
 * and each of those is a decision an ADR refused by name. They are asserted in
 * the ordinary suite so the reversal has to argue with a red test on every PR.
 *
 * ⚠️ **THE GRANT CASES BELOW ARE SCOPED TO THIS ONE MIGRATION FILE, AND THAT IS
 * 🚫 NOT THE PRODUCT RULE.** What `age_app` may do to `operator_sessions` is a
 * property of the whole migration SET — ADR-0074 D3 added a column-scoped UPDATE
 * in a later file, and ADR-0079 §3 added an INSERT in a later one still. Those
 * are asserted, exactly and across every migration, in
 * `accounts-memberships-and-issuance-schema.spec.ts`. 🛑 Read these cases as
 * *"this file grants nothing more than it did"*, 🚫 never as *"AGE cannot write"*.
 *
 * 🚫 THIS IS NOT THE ISOLATION PROOF. Reading SQL never proves what PostgreSQL
 * does with it (ADR-0046 D5, and the reason the live suite connects as a
 * non-owner, NOBYPASSRLS role).
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const PRISMA = join(HERE, '..', 'prisma');

const SCHEMA = readFileSync(join(PRISMA, 'schema.prisma'), 'utf8');
const MIGRATION = readFileSync(
  join(PRISMA, 'migrations', '20260811000000_operator_sessions', 'migration.sql'),
  'utf8',
);

/** SQL with its `--` commentary removed — a file's own explanation of a rule
 * must not satisfy a scan for that rule's violation. */
const SQL = MIGRATION.replace(/^\s*--.*$/gm, '');

/**
 * The model block only, so 🚫 no OTHER model's columns can answer for it.
 *
 * ⚠️ **BOUNDED AT BOTH ENDS, AND IT HAS TO BE.** This used to slice from the
 * model to the END OF THE FILE, which was correct only for as long as
 * `OperatorSession` happened to be the last model in the schema. ADR-0079 added
 * `AccountMembership` after it — a model that legitimately carries `role_bundle`
 * and `client_id` — and every "the session row has no such column" case below
 * would have started failing against a column that is 🚫 not on the session row
 * at all. ⚠️ **A SCAN WIDER THAN ITS RULE IS AS WRONG AS ONE THAT IS NARROWER.**
 */
const MODEL_START = SCHEMA.indexOf('model OperatorSession {');
const MODEL = SCHEMA.slice(MODEL_START, SCHEMA.indexOf('\n}', MODEL_START) + 2);

describe('the migration file was read at all', () => {
  it('found both files, with content', () => {
    expect(SCHEMA.length).toBeGreaterThan(1000);
    expect(SQL).toContain('CREATE TABLE "operator_sessions"');
    expect(MODEL).toContain('@@map("operator_sessions")');
    // 🛑 And the slice really ENDS: a MODEL that ran to the end of the file
    // would let another model's columns satisfy — or violate — every case below.
    expect(MODEL).not.toContain('model AccountMembership');
    expect(SCHEMA).toContain('model AccountMembership');
  });
});

describe('🛑 AGE reads this store and never writes it', () => {
  it('grants SELECT to the application role', () => {
    expect(SQL).toContain('GRANT SELECT ON TABLE "operator_sessions" TO age_app;');
  });

  it.each(['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'ALL'])(
    '🚫 grants no %s',
    (privilege) => {
      // 🛑 VERIFICATION IS NOT ISSUANCE (ADR-0068 §0.1b). The second operator's
      // row is planted as an ACT, out of band — 🚫 never by a provisioning code
      // path (§0.1c), which this grant makes impossible rather than discouraged.
      const grants = SQL.match(/GRANT[^;]+;/g) ?? [];

      expect(grants.length).toBeGreaterThan(0);
      for (const grant of grants) {
        if (!grant.includes('operator_sessions')) continue;
        expect(grant, grant).not.toContain(privilege);
      }
    },
  );

  it('🚫 grants nothing to PUBLIC', () => {
    expect(SQL).not.toContain('PUBLIC');
  });

  it('has a SELECT policy and 🚫 no policy that permits a write', () => {
    const policies = SQL.match(/CREATE POLICY[\s\S]*?;/g) ?? [];

    expect(policies).toHaveLength(1);
    expect(policies[0]).toContain('FOR SELECT');
    expect(policies[0]).not.toContain('WITH CHECK');
  });
});

describe('the policy is forced and fails closed', () => {
  it('enables and FORCEs row-level security', () => {
    expect(SQL).toContain('ALTER TABLE "operator_sessions" ENABLE ROW LEVEL SECURITY;');
    expect(SQL).toContain('ALTER TABLE "operator_sessions" FORCE ROW LEVEL SECURITY;');
  });

  it('folds a missing and an empty setting onto the same NULL', () => {
    // ⚠️ Without `NULLIF`, a session that set `age.organization_id` to '' would
    // match a row whose organization is '' — two absences agreeing.
    expect(SQL).toContain(`NULLIF(current_setting('age.organization_id', true), '')`);
  });

  it('scopes by the organization, 🚫 not by a client', () => {
    // ADR-0062 D1/D2 — the tenant is the organization; a client is a subject.
    expect(SQL).not.toContain('age.client_id');
    expect(SQL).not.toContain('client_id');
  });
});

describe('🚫 the row carries no authorization and no invented fact', () => {
  it.each(['isAdmin', 'is_admin', 'role', 'permission', 'scopes', 'claims'])(
    'has no %s column',
    (column) => {
      // ADR-0062 D3 — admin is never a bypass, and a column is how one arrives.
      expect(MODEL.toLowerCase()).not.toContain(column.toLowerCase());
      expect(SQL.toLowerCase()).not.toContain(`"${column.toLowerCase()}"`);
    },
  );

  it('🚫 stores no raw token, only a digest', () => {
    expect(MODEL).toContain('tokenHash');
    expect(MODEL).not.toContain('token String');
    expect(SQL).toContain('"token_hash" TEXT NOT NULL');
    expect(SQL).not.toContain('"token" TEXT');
  });

  it('🚫 has no DEFAULT of any kind, and no server-generated time', () => {
    expect(SQL).not.toContain('DEFAULT');
    expect(SQL).not.toContain('now()');
    expect(MODEL).not.toContain('@default');
    expect(MODEL).not.toContain('@updatedAt');
  });

  it('🛑 requires an expiry and 🚫 allows no "never expires"', () => {
    expect(SQL).toContain('"expires_at" TEXT NOT NULL');
    expect(MODEL).toMatch(/expiresAt\s+String\s+@map\("expires_at"\)/);
  });

  it('keeps revocation as a nullable column, 🚫 never a deleted row', () => {
    expect(SQL).toContain('"revoked_at" TEXT');
    expect(MODEL).toMatch(/revokedAt\s+String\?\s+@map\("revoked_at"\)/);
  });

  it('makes one token match at most one session', () => {
    expect(SQL).toContain('CREATE UNIQUE INDEX "operator_sessions_token_hash_key"');
  });
});
