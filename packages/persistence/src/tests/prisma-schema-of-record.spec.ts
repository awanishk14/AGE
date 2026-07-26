import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The repository has exactly ONE Prisma schema, and every Prisma command names
 * it (ADR-0042, ADR-0032 D3).
 *
 * WHY THIS TEST EXISTS. `apps/api/prisma/schema.prisma` was a scaffold that
 * outlived its purpose: a second schema file, with a placeholder model, that
 * nothing imported, generated from, migrated or read. It was harmless right up
 * until someone mistook it for the schema of record. ADR-0042 removed it and
 * forbade a replacement (D4), which is a rule that only holds if something
 * fails when it is broken.
 *
 * WHY REPOSITORY-WIDE RATHER THAN "NONE UNDER apps/". ADR-0042 D4 states the
 * intent as "exactly one Prisma schema file", not "none in one directory", and
 * the narrower assertion would pass while a second schema appeared in a package
 * — the same ambiguity in a different folder. A legitimate future schema is not
 * blocked by this test so much as routed through an ADR, which is where a
 * second source of truth belongs.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const SCHEMA_OF_RECORD = join('packages', 'persistence', 'src', 'prisma', 'schema.prisma');

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  '.git',
  '.nx',
  '.turbo',
  'coverage',
  'build',
  '.next',
]);

function collectFiles(directory: string, predicate: (name: string) => boolean): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory)) {
    if (IGNORED_DIRECTORIES.has(entry)) continue;

    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      found.push(...collectFiles(full, predicate));
    } else if (predicate(entry)) {
      found.push(full);
    }
  }

  return found;
}

const schemaFiles = collectFiles(REPO_ROOT, (name) => name === 'schema.prisma').map((file) =>
  relative(REPO_ROOT, file),
);

const packageJsonFiles = collectFiles(REPO_ROOT, (name) => name === 'package.json').map((file) =>
  relative(REPO_ROOT, file),
);

function readScripts(file: string): Record<string, string> {
  const parsed = JSON.parse(readFileSync(join(REPO_ROOT, file), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  return parsed.scripts ?? {};
}

function readDependencyNames(file: string): string[] {
  const parsed = JSON.parse(readFileSync(join(REPO_ROOT, file), 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  return [...Object.keys(parsed.dependencies ?? {}), ...Object.keys(parsed.devDependencies ?? {})];
}

describe('Prisma schema of record (ADR-0042)', () => {
  it('finds files at all, so an empty scan cannot pass the tests below', () => {
    // Every assertion here is a "nothing matches" shape. Without this, a broken
    // walk would report perfect compliance.
    expect(packageJsonFiles.length).toBeGreaterThan(10);
    expect(schemaFiles.length).toBeGreaterThan(0);
  });

  it('has exactly one Prisma schema, and it is the schema of record', () => {
    expect(schemaFiles).toEqual([SCHEMA_OF_RECORD]);
  });

  it('keeps no Prisma schema under apps/', () => {
    // The specific regression ADR-0042 D1 removed, asserted by itself so a
    // failure names the actual cause rather than a count.
    const underApps = schemaFiles.filter((file) => file.startsWith(`apps${sep}`));

    expect(underApps).toEqual([]);
  });

  it('declares the schema of record with the snapshot model and no placeholder', () => {
    const schema = readFileSync(join(REPO_ROOT, SCHEMA_OF_RECORD), 'utf8');

    expect(schema).toContain('model ScoredBifSnapshot');
    expect(schema).not.toContain('model HealthCheck');
  });

  it('names a schema in every Prisma command that resolves one (ADR-0032 D3)', () => {
    // `prisma generate|validate|migrate|db|format|studio` all resolve a schema.
    // Two spellings are legitimate: `--schema` for commands that act on one, and
    // `--to-schema-datamodel` for `migrate diff`, which compares two states.
    const offenders: string[] = [];

    for (const file of packageJsonFiles) {
      for (const [name, command] of Object.entries(readScripts(file))) {
        if (!/(^|\s|&&\s*)prisma\s+(generate|validate|migrate|db|format|studio)\b/u.test(command)) {
          continue;
        }
        if (command.includes('--schema') || command.includes('--to-schema-datamodel')) continue;

        offenders.push(`${file} → ${name}: ${command}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('leaves no script pointing at the deleted apps/api schema', () => {
    const offenders: string[] = [];

    for (const file of packageJsonFiles) {
      for (const [name, command] of Object.entries(readScripts(file))) {
        if (/apps\/api\/prisma|prisma:migrate:scaffold/u.test(command)) {
          offenders.push(`${file} → ${name}: ${command}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps Prisma out of apps/ dependencies, which own no schema (ADR-0042 D3, D5)', () => {
    const offenders: string[] = [];

    for (const file of packageJsonFiles.filter((f) => f.startsWith(`apps${sep}`))) {
      for (const dependency of readDependencyNames(file)) {
        if (dependency === 'prisma' || dependency === '@prisma/client') {
          offenders.push(`${file} → ${dependency}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('still lets the persistence package depend on Prisma, which legitimately uses it', () => {
    // The rule above is about schema ownership, not a repository-wide ban: this
    // package's live database specs import `PrismaClient` directly.
    const dependencies = readDependencyNames(join('packages', 'persistence', 'package.json'));

    expect(dependencies).toContain('prisma');
    expect(dependencies).toContain('@prisma/client');
  });
});
