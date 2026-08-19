import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * ADR-0082's shape, asserted without a database.
 *
 * 🛑 **THE SCANS BELOW ARE PRODUCT-WIDE ON PURPOSE.** The rule ADR-0082 D2/D3
 * states is a property of the whole migration SET — *"the platform path is
 * named, and the tenant setting is never given a sentinel value"* — and a scan
 * of one file could not see a second file breaking it. ⚠️ **A NARROW SCAN IS
 * NOT A NARROW RULE**, and that one pattern produced every audit gap this
 * repository has found.
 *
 * 🚫 **THIS IS NOT THE ISOLATION PROOF.** Reading SQL never proves what
 * PostgreSQL does with it (ADR-0046 D5). `platform-session-rls.db.spec.ts`
 * connects as the non-owner, NOBYPASSRLS role and does that.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const PRISMA = join(HERE, '..', 'prisma');
const MIGRATIONS = join(PRISMA, 'migrations');

const SCHEMA = readFileSync(join(PRISMA, 'schema.prisma'), 'utf8');

const THIS_MIGRATION_DIR = '20260819100000_platform_sessions_without_an_organization';

/** Every migration in the repository, newest-last, as `[name, sql]`. */
const ALL: ReadonlyArray<readonly [string, string]> = readdirSync(MIGRATIONS)
  .filter((entry) => !entry.endsWith('.toml'))
  .sort()
  .map((entry) => [entry, readFileSync(join(MIGRATIONS, entry, 'migration.sql'), 'utf8')] as const);

/**
 * SQL with its `--` commentary removed. 🛑 A file's own explanation of a rule
 * must never satisfy a scan for that rule's violation — every comment in this
 * repository names the things it refuses, so an uncommented scan would find
 * them all and pass.
 */
function withoutComments(sql: string): string {
  return sql.replace(/^[ \t]*--.*$/gm, '');
}

const THIS_MIGRATION = withoutComments(
  ALL.find(([name]) => name === THIS_MIGRATION_DIR)?.[1] ?? '',
);

function policiesIn(sql: string): readonly string[] {
  return withoutComments(sql).match(/CREATE POLICY[\s\S]*?;/g) ?? [];
}

describe('🛑 the migration this slice adds exists and is the only place the fence is named', () => {
  it('walked the migrations rather than trusting one path', () => {
    // ⚠️ A floor, so a walk that silently found nothing fails here rather than
    // passing every scan below vacuously.
    expect(ALL.length).toBeGreaterThanOrEqual(8);
    expect(THIS_MIGRATION.length).toBeGreaterThan(0);
  });

  it('names `age.platform_session_token_hash` in exactly one migration', () => {
    const setters = ALL.filter(([, sql]) =>
      withoutComments(sql).includes('age.platform_session_token_hash'),
    );

    expect(setters.map(([name]) => name)).toEqual([THIS_MIGRATION_DIR]);
  });

  it('🚫 never gives the tenant setting a sentinel value anywhere (ADR-0082 D3)', () => {
    // 🛑 THE REFUSED OPTION, REFUSED IN A TEST. Option B was "store a reserved
    // literal", and reusing `age.organization_id` with an agreed value is the
    // same thing by another route. Every comparison against that setting must
    // be against a COLUMN, 🚫 never against a quoted string.
    // ⚠️ Reported as a LIST OF OFFENDING FILES rather than one boolean per
    // file. A per-file `toBe` compares two strings that share a long migration
    // name, and the reporter truncates them to an identical prefix — a failure
    // that fires without saying what broke is barely better than one that
    // does not fire.
    const sentinelled = ALL.filter(
      ([, sql]) =>
        /current_setting\('age\.organization_id'[^)]*\)\s*=\s*'/.test(withoutComments(sql)) ||
        withoutComments(sql).includes("'superadmin'"),
    ).map(([name]) => name);

    expect(sentinelled).toEqual([]);
  });
});

describe('🛑 the column is nullable, in the migration AND in the schema of record', () => {
  it('drops NOT NULL rather than rewriting the table', () => {
    expect(THIS_MIGRATION).toContain(
      'ALTER TABLE "operator_sessions" ALTER COLUMN "organization_id" DROP NOT NULL;',
    );
  });

  it('declares it nullable in `schema.prisma`', () => {
    // ⚠️ If these two disagree, `prisma migrate diff` reports drift and the
    // deployed store and the schema of record describe different tables.
    expect(SCHEMA).toMatch(/organizationId\s+String\?\s+@map\("organization_id"\)/);
  });

  it('🚫 does not drop NOT NULL from anything else', () => {
    const drops = THIS_MIGRATION.match(/DROP NOT NULL/g) ?? [];

    expect(drops).toHaveLength(1);
  });
});

describe('🛑 the three new policies are ADDITIVE — 🚫 no existing one is touched', () => {
  it('creates exactly three policies and drops none', () => {
    expect(policiesIn(THIS_MIGRATION)).toHaveLength(3);
    expect(THIS_MIGRATION).not.toContain('DROP POLICY');
    expect(THIS_MIGRATION).not.toContain('ALTER POLICY');
  });

  it('🚫 leaves the three tenant policies unmentioned by name', () => {
    // 🛑 ADR-0082 D2. Permissive policies OR, so the tenant behaviour is
    // byte-identical only for as long as this file never names them.
    for (const existing of [
      'operator_sessions_select_in_scope',
      'operator_sessions_issue_in_scope',
      'operator_sessions_revoke_in_scope',
    ]) {
      expect(`${existing}: ${THIS_MIGRATION.includes(existing)}`).toBe(`${existing}: false`);
    }
  });

  it('gates every one of them on a NULL organization AND the digest', () => {
    for (const policy of policiesIn(THIS_MIGRATION)) {
      expect(policy, policy).toContain('"organization_id" IS NULL');
      // ⚠️ Without `NULLIF`, a caller that set the digest to '' would match a
      // row whose digest is '' — two absences agreeing.
      expect(policy, policy).toContain(
        `NULLIF(current_setting('age.platform_session_token_hash', true), '')`,
      );
      // 🚫 The tenant setting has no business in a platform policy.
      expect(policy, policy).not.toContain('age.organization_id');
    }
  });

  it('🛑 writes `WITH CHECK` on both the INSERT and the UPDATE', () => {
    const policies = policiesIn(THIS_MIGRATION);
    const insert = policies.filter((policy) => policy.includes('FOR INSERT'));
    const update = policies.filter((policy) => policy.includes('FOR UPDATE'));
    const select = policies.filter((policy) => policy.includes('FOR SELECT'));

    expect(insert).toHaveLength(1);
    expect(update).toHaveLength(1);
    expect(select).toHaveLength(1);

    // 🛑 A `USING`-only UPDATE policy would let a platform session be updated
    // INTO a tenant. `WITH CHECK` is what refuses the row it would become.
    expect(update[0]).toContain('USING');
    expect(update[0]).toContain('WITH CHECK');

    // ⚠️ `USING` on a FOR INSERT policy is meaningless — there is no prior row.
    expect(insert[0]).toContain('WITH CHECK');
    expect(insert[0]).not.toContain('USING');

    // 🚫 A SELECT policy with a `WITH CHECK` would be a write surface wearing a
    // read verb.
    expect(select[0]).not.toContain('WITH CHECK');
  });
});

describe('🛑 AGE mints nothing new — the migration buys 🚫 NO privilege', () => {
  it('🚫 grants nothing at all', () => {
    expect(THIS_MIGRATION).not.toContain('GRANT');
    expect(THIS_MIGRATION).not.toContain('PUBLIC');
  });

  it('🛑 leaves the UPDATE grant column-scoped across every migration', () => {
    // 🛑 PRODUCT-WIDE. `GRANT UPDATE ON TABLE` is a one-word edit away from the
    // shipped grant, and it would let a caller extend an expiry or repoint a
    // digest — neither of which appears as a difference in a policy scan.
    const updates = ALL.flatMap(
      ([, sql]) => withoutComments(sql).match(/GRANT UPDATE[^;]*;/g) ?? [],
    );

    expect(updates).toEqual([
      'GRANT UPDATE ("revoked_at") ON TABLE "operator_sessions" TO age_app;',
    ]);
  });

  it('🚫 still grants no DELETE and no TRUNCATE on a session, anywhere', () => {
    for (const [name, sql] of ALL) {
      const grants = withoutComments(sql).match(/GRANT[^;]*operator_sessions[^;]*;/g) ?? [];

      for (const grant of grants) {
        expect(`${name}: ${grant}`).not.toContain('DELETE');
        expect(`${name}: ${grant}`).not.toContain('TRUNCATE');
        expect(`${name}: ${grant}`).not.toContain('ALL');
      }
    }
  });

  it('🚫 has no DEFAULT of any kind, and no server-generated time', () => {
    expect(THIS_MIGRATION).not.toContain('DEFAULT');
    expect(THIS_MIGRATION).not.toContain('now()');
  });
});
