import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * The source-observation store's SHAPE, asserted without a database.
 *
 * WHY THIS EXISTS ALONGSIDE THE LIVE SUITE. `source-observations-rls.db.spec.ts`
 * proves the policies behave, but it only runs in the path-gated live job. The
 * facts below are ones a future migration could quietly reverse — a `status`
 * column, a `DEFAULT now()`, an UPDATE grant "just to fix a typo", a
 * `client_id` — and each of those is a decision ADR-0069 refused by name. They
 * are asserted in the ordinary suite so the reversal has to argue with a red
 * test on every PR.
 *
 * 🚫 THIS IS NOT THE ISOLATION PROOF. Reading SQL never proves what PostgreSQL
 * does with it (ADR-0046 D5, and the reason the live suite connects as a
 * non-owner, NOBYPASSRLS role).
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const PRISMA = join(HERE, '..', 'prisma');

const SCHEMA = readFileSync(join(PRISMA, 'schema.prisma'), 'utf8');
const MIGRATION = readFileSync(
  join(PRISMA, 'migrations', '20260813000000_source_observations', 'migration.sql'),
  'utf8',
);

/** SQL with its `--` commentary removed — a file's own explanation of a rule
 * must not satisfy a scan for that rule's violation. */
const SQL = MIGRATION.replace(/^\s*--.*$/gm, '');

/** The model block only, so another model's columns cannot answer for it. */
const MODEL = SCHEMA.slice(SCHEMA.indexOf('model SourceObservation {'));

describe('the migration file was read at all', () => {
  it('found both files, with content', () => {
    expect(SCHEMA.length).toBeGreaterThan(1000);
    expect(SQL).toContain('CREATE TABLE "source_observations"');
    expect(MODEL).toContain('@@map("source_observations")');
  });
});

describe('🛑 append-only — AGE adds observations and can never edit one', () => {
  it('grants SELECT and INSERT to the application role', () => {
    expect(SQL).toContain('GRANT SELECT, INSERT ON TABLE "source_observations" TO age_app;');
  });

  it.each(['UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'ALL PRIVILEGES'])(
    '🚫 grants no %s',
    (privilege) => {
      const grants = SQL.match(/GRANT[^;]+;/g) ?? [];

      expect(grants.length).toBeGreaterThan(0);
      for (const grant of grants) {
        if (!grant.includes('source_observations')) continue;
        expect(grant, grant).not.toContain(privilege);
      }
    },
  );

  it('🚫 grants nothing to PUBLIC', () => {
    expect(SQL).not.toContain('PUBLIC');
  });

  it('has exactly one SELECT policy and one INSERT policy, and 🚫 no other', () => {
    const policies = SQL.match(/CREATE POLICY[\s\S]*?;/g) ?? [];

    expect(policies).toHaveLength(2);
    expect(policies.filter((policy) => policy.includes('FOR SELECT'))).toHaveLength(1);
    expect(policies.filter((policy) => policy.includes('FOR INSERT'))).toHaveLength(1);
    expect(policies.filter((policy) => /FOR (UPDATE|DELETE|ALL)/.test(policy))).toHaveLength(0);
  });

  it.each(['updated_at', 'version', 'deleted_at', 'current'])(
    '🚫 has no `%s` column — append-only is enforced by what is absent',
    (column) => {
      expect(SQL).not.toContain(`"${column}"`);
    },
  );
});

describe('🛑 source arrival is never confirmation (ADR-0069 D5)', () => {
  it.each([
    'status',
    'confirmed',
    'accepted',
    'dismissed',
    'weight',
    'trust',
    'score',
    'confidence',
    'priority',
    'rank',
  ])('🚫 has no `%s` column', (column) => {
    // Each of these is a way for an inbound observation to promote itself, and
    // the first thing anyone does with such a column is read it as agreement.
    expect(SQL.toLowerCase()).not.toContain(`"${column}"`);
    expect(MODEL.toLowerCase()).not.toMatch(new RegExp(`@map\\("${column}"\\)`));
  });
});

describe('🚫 no raw corpus, ever', () => {
  it.each(['payload', 'body', 'raw', 'rows', 'document', 'json', 'jsonb'])(
    '🚫 has no `%s` column for 50,000 keyword rows to arrive in',
    (column) => {
      expect(SQL.toLowerCase()).not.toContain(`"${column}"`);
    },
  );

  it('keeps only a REFERENCE back into the source system', () => {
    expect(SQL).toContain('"source_record_id" TEXT NOT NULL');
  });
});

describe('the policy is forced and fails closed', () => {
  it('enables and FORCEs row-level security', () => {
    expect(SQL).toContain('ALTER TABLE "source_observations" ENABLE ROW LEVEL SECURITY;');
    expect(SQL).toContain('ALTER TABLE "source_observations" FORCE ROW LEVEL SECURITY;');
  });

  it('folds a missing and an empty setting onto the same NULL', () => {
    const uses = SQL.match(/NULLIF\(current_setting\('age\.organization_id', true\), ''\)/g) ?? [];

    // ⚠️ Both policies, not just the one that happens to be read first.
    expect(uses).toHaveLength(2);
  });

  it('scopes by the organization, 🚫 not by a client — ADR-0066 D7 uncrossed BY SHAPE', () => {
    expect(SQL).not.toContain('client_id');
    expect(MODEL).not.toContain('clientId');
  });
});

describe('🛑 the subject keeps its two shapes apart, in the database itself', () => {
  it('constrains a modelled row to name its kind and an unmapped row not to', () => {
    expect(SQL).toContain('source_observations_subject_shape_check');
    expect(SQL).toMatch(/'modelled' AND "subject_kind" IS NOT NULL/);
    expect(SQL).toMatch(/'unmapped' AND "subject_kind" IS NULL/);
  });

  it('leaves `subject_kind` nullable — 🚫 NULL is the point, never a guessed kind', () => {
    expect(SQL).toMatch(/"subject_kind" TEXT,/);
    expect(MODEL).toMatch(/subjectKind\s+String\?\s+@map\("subject_kind"\)/);
  });
});

describe('🚫 no server-generated fact', () => {
  it('has no DEFAULT of any kind, and no `now()`', () => {
    expect(SQL).not.toContain('DEFAULT');
    expect(SQL).not.toContain('now()');
    expect(MODEL).not.toContain('@default');
    expect(MODEL).not.toContain('@updatedAt');
  });

  it('keeps `recorded_at` and `observed_at` as separate columns', () => {
    // A relay happens days after the observation BY CONSTRUCTION; collapsing the
    // two would make every relayed observation look freshly made.
    expect(SQL).toContain('"observed_at" TEXT NOT NULL');
    expect(SQL).toContain('"recorded_at" TEXT NOT NULL');
  });
});

describe('🚫 the store is source-neutral (ADR-0069 D6)', () => {
  it.each(['rankops', 'mcp-ads-server', 'content-intelligence', 'snara', 'humantik'])(
    '🚫 names no peer product (%s)',
    (product) => {
      // `source_system` is DATA, never a branch and never an enum: a sixth peer
      // product must be a new value, not an AGE release.
      expect(SQL.toLowerCase()).not.toContain(product);
      expect(MODEL.toLowerCase()).not.toContain(product);
    },
  );

  it('stores the source system as free text, 🚫 not a constrained enum', () => {
    expect(SQL).toContain('"source_system" TEXT NOT NULL');
    expect(SQL).not.toMatch(/CHECK\s*\([^)]*"source_system"/);
  });
});
