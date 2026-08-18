import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * The SHAPE of ADR-0079 slice 2, asserted without a database.
 *
 * 🛑 **WHY IT SCANS EVERY MIGRATION AND 🚫 NOT ONE FILE.** Its sibling,
 * `operator-sessions-schema.spec.ts`, asserts *"grants no INSERT"* against ONE
 * migration — and that is still a true statement about THAT FILE, which is
 * exactly the trap: the grant a later migration adds is invisible to it. **What
 * a role may do to a table is a property of the MIGRATION SET, 🚫 not of any
 * file in it**, so the scan below is over all of them. ⚠️ **A NARROW SCAN IS NOT
 * A NARROW RULE** — the single lesson of PRs #377/#378, and the reason this file
 * exists rather than a few more cases in the sibling.
 *
 * 🛑 **AND THE GRANT SET IS THE PRODUCT BOUNDARY ITSELF.** ADR-0079 §3 overturned
 * one refusal — AGE may now START a session — and 🚫 NOTHING else. `accounts` and
 * `account_memberships` are readable and 🚫 never writable, because **AGE mints
 * nothing: provisioning is a human act**. The distance between a sign-in page and
 * a sign-up page is these five words of SQL, so they are asserted EXACTLY.
 *
 * 🚫 THIS IS NOT THE ISOLATION PROOF. Reading SQL never proves what PostgreSQL
 * does with it (ADR-0046 D5) — that is `accounts-and-memberships-rls.db.spec.ts`,
 * connected as a non-owner, NOBYPASSRLS role.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const PRISMA = join(HERE, '..', 'prisma');
const MIGRATIONS = join(PRISMA, 'migrations');

const SCHEMA = readFileSync(join(PRISMA, 'schema.prisma'), 'utf8');

/** SQL with its `--` commentary removed — a file's own explanation of a rule
 * must not satisfy a scan for that rule's violation. */
function withoutComments(sql: string): string {
  return sql.replace(/^\s*--.*$/gm, '');
}

const MIGRATION_FILES = readdirSync(MIGRATIONS)
  .filter((entry) => entry !== 'migration_lock.toml')
  .map((entry) => join(MIGRATIONS, entry, 'migration.sql'));

const ALL_SQL = MIGRATION_FILES.map((file) => withoutComments(readFileSync(file, 'utf8'))).join(
  '\n',
);

const THIS_MIGRATION = withoutComments(
  readFileSync(
    join(MIGRATIONS, '20260818000000_accounts_memberships_and_session_issuance', 'migration.sql'),
    'utf8',
  ),
);

/** Every `GRANT … ;` statement in the migration set, whichever file it lives in. */
const GRANTS = ALL_SQL.match(/GRANT[^;]+;/g) ?? [];

function grantsMentioning(table: string): string[] {
  return GRANTS.filter((grant) => grant.includes(`"${table}"`));
}

describe('the migration set was read at all', () => {
  it('found every migration, and more than one of them', () => {
    // 🛑 The walk asserts it found files FIRST: an empty scan reporting
    // compliance is the failure mode every guard here exists to avoid.
    expect(MIGRATION_FILES.length).toBeGreaterThan(4);
    expect(GRANTS.length).toBeGreaterThan(4);
    expect(ALL_SQL).toContain('CREATE TABLE "accounts"');
    expect(ALL_SQL).toContain('CREATE TABLE "account_memberships"');
  });

  it('reached grants written in a file OTHER than this migration', () => {
    // ⚠️ The whole point of scanning the set: the revocation grant lives in
    // `20260815000000`, and a scan that could not see it could not see a DELETE
    // added there either.
    expect(GRANTS.some((grant) => !THIS_MIGRATION.includes(grant))).toBe(true);
  });
});

describe('🛑 AGE mints nothing — an account and a membership are read, never written', () => {
  it.each(['accounts', 'account_memberships'])(
    'grants SELECT on %s and 🚫 nothing else, in the whole migration set',
    (table) => {
      const grants = grantsMentioning(table);

      expect(grants).toHaveLength(1);
      expect(grants[0]).toContain(`GRANT SELECT ON TABLE "${table}" TO age_app`);
      for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'ALL']) {
        expect(grants[0], grants[0]).not.toContain(privilege);
      }
    },
  );

  it('🚫 gives the application role no policy that permits writing either table', () => {
    const policies = THIS_MIGRATION.match(/CREATE POLICY[\s\S]*?;/g) ?? [];
    const onTheseTables = policies.filter(
      (policy) => policy.includes('"accounts"') || policy.includes('"account_memberships"'),
    );

    expect(onTheseTables).toHaveLength(2);
    for (const policy of onTheseTables) {
      expect(policy).toContain('FOR SELECT');
      expect(policy, policy).not.toContain('WITH CHECK');
    }
  });
});

describe('🛑 AGE may START a session, and that is the ONLY thing ADR-0079 §3 changed', () => {
  it('grants INSERT on the sessions table — once, and named', () => {
    const grants = grantsMentioning('operator_sessions');

    expect(grants.filter((grant) => grant.includes('INSERT'))).toEqual([
      'GRANT INSERT ON TABLE "operator_sessions" TO age_app;',
    ]);
  });

  it('🚫 still grants no DELETE and no TRUNCATE on a session, anywhere', () => {
    for (const grant of grantsMentioning('operator_sessions')) {
      expect(grant, grant).not.toContain('DELETE');
      expect(grant, grant).not.toContain('TRUNCATE');
      expect(grant, grant).not.toContain('ALL');
    }
  });

  it('🛑 keeps the ONE update column-scoped — 🚫 never `GRANT UPDATE ON TABLE`', () => {
    const updates = grantsMentioning('operator_sessions').filter((grant) =>
      grant.includes('UPDATE'),
    );

    // ⚠️ ADR-0074 D3's grant, unchanged by this slice. Dropping the column list
    // would let a caller extend an expiry or repoint a digest, and neither
    // appears in `information_schema.table_privileges` as a difference.
    expect(updates).toEqual([
      'GRANT UPDATE ("revoked_at") ON TABLE "operator_sessions" TO age_app;',
    ]);
  });

  it('adds an INSERT policy that fails closed on an unscoped transaction', () => {
    const policies = THIS_MIGRATION.match(/CREATE POLICY[\s\S]*?;/g) ?? [];
    const insertPolicies = policies.filter((policy) => policy.includes('FOR INSERT'));

    expect(insertPolicies).toHaveLength(1);
    expect(insertPolicies[0]).toContain('"operator_sessions"');
    expect(insertPolicies[0]).toContain('WITH CHECK');
    // ⚠️ Without `NULLIF`, a transaction that set `age.organization_id` to ''
    // could write a row whose organization is '' — two absences agreeing.
    expect(insertPolicies[0]).toContain(`NULLIF(current_setting('age.organization_id', true), '')`);
  });

  it('🚫 grants nothing to PUBLIC', () => {
    expect(THIS_MIGRATION).not.toContain('PUBLIC');
  });
});

describe('the new tables are forced, closed and carry no invented fact', () => {
  it.each(['accounts', 'account_memberships'])('enables and FORCEs RLS on %s', (table) => {
    expect(THIS_MIGRATION).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
    expect(THIS_MIGRATION).toContain(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
  });

  it('🚫 has no DEFAULT of any kind, and no server-generated time', () => {
    // 🛑 Every instant AGE stores is one it was GIVEN. A `DEFAULT now()` is a
    // fact the database invents, and 🚫 nothing can tell it apart afterwards.
    expect(THIS_MIGRATION).not.toContain('DEFAULT');
    expect(THIS_MIGRATION).not.toContain('now()');
  });

  it('🚫 stores no credential on an account — sign-in is verified elsewhere', () => {
    for (const token of ['password', 'secret', 'token', 'credential', 'api_key']) {
      expect(THIS_MIGRATION.toLowerCase(), token).not.toContain(`"${token}"`);
    }
  });

  it('🛑 keeps the three scope shapes in the database, 🚫 not only in the type system', () => {
    // ⚠️ Prisma cannot express this, so the CHECK is the only thing that refuses
    // a client membership with no client — which would authorize a viewer
    // against every client of an agency.
    expect(THIS_MIGRATION).toContain('account_memberships_shape_check');
    expect(THIS_MIGRATION).toContain("'platform'");
    expect(THIS_MIGRATION).toContain("'agency'");
    expect(THIS_MIGRATION).toContain("'client'");
  });

  it('declares both models in the schema of record, mapped to these tables', () => {
    expect(SCHEMA).toContain('model Account {');
    expect(SCHEMA).toContain('@@map("accounts")');
    expect(SCHEMA).toContain('model AccountMembership {');
    expect(SCHEMA).toContain('@@map("account_memberships")');
    expect(SCHEMA).not.toContain('@default');
  });
});
