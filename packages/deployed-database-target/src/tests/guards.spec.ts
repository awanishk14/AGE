import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * ⚠️ Guard-test pattern (repo conventions): every walk asserts it found files
 * first, so an empty scan can never report compliance, and comments are stripped
 * before scanning — this module explains at length why it refuses `allowRemote`,
 * and a guard that fails on its own explanation gets deleted rather than fixed.
 */

const SRC = join(__dirname, '..');
const REPO = join(__dirname, '..', '..', '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (entry === 'node_modules' || entry === 'dist') return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') && !full.endsWith('.spec.ts') ? [full] : [];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const FILES = sourceFiles(SRC);
const POLICY = stripComments(readFileSync(join(SRC, 'deployed-database-target.ts'), 'utf8'));

describe('@age/deployed-database-target decides about strings only', () => {
  it('found source files to scan', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(2);
  });

  it.each([
    '@prisma/client',
    'PrismaClient',
    '@age/persistence',
    'node:fs',
    'node:net',
    'node:dns',
    'fetch(',
    'new Date(',
    'Date.now(',
    'Math.random(',
    'process.env',
    'process.cwd',
  ])('contains no %s', (token) => {
    let examined = 0;
    for (const file of FILES) {
      examined += 1;
      expect(stripComments(readFileSync(file, 'utf8')), file).not.toContain(token);
    }
    expect(examined).toBe(FILES.length);
  });
});

describe('A5 refuses the three shapes it names (ADR-0061 §2 Q5)', () => {
  it.each(['allowRemote', 'allowPublic', 'skipCheck', 'devMode', 'DANGEROUSLY'])(
    'has no %s escape hatch anywhere in the package',
    (token) => {
      let examined = 0;
      for (const file of FILES) {
        examined += 1;
        expect(stripComments(readFileSync(file, 'utf8')), file).not.toContain(token);
      }
      expect(examined).toBe(FILES.length);
    },
  );

  it('states what it permits rather than what it forbids', () => {
    // ⚠️ A deny-list of "known public ranges" leaves every range nobody thought
    // of, and "not obviously public" is how a client's rows reach the internet.
    expect(POLICY).toContain('LOOPBACK_HOSTS');
    expect(POLICY).toMatch(/return\s+undefined;\s*\n\}/);
  });

  it('cannot be selected by an environment variable alone', () => {
    // 🛑 The acknowledgement's type is a single string literal, so a
    // `string | undefined` read from an environment cannot reach it — and the
    // runtime check covers the cast that defeats the type.
    expect(POLICY).toContain('acknowledgedRemote: RemoteAcknowledgement');
    expect(POLICY).not.toMatch(/acknowledgedRemote\s*:\s*(string|boolean)/);
    expect(POLICY).toContain('options.acknowledgedRemote !== REMOTE_ACKNOWLEDGEMENT');
  });

  it('holds the one cast into the branded type', () => {
    // ⚠️ The brand is worth something only while the cast that defeats it lives
    // in exactly one place, above the judgement rather than beside it.
    const casts = POLICY.match(/as DeployedDatabaseUrl/g) ?? [];
    expect(casts).toHaveLength(1);
  });
});

describe('the local rule keeps its teeth and is a different code path', () => {
  const LOCAL = join(REPO, 'apps', 'capture', 'src', 'local-database-target.ts');

  it('is still present, still loopback-only', () => {
    // 🚫 ADR-0061 A5 revisits ADR-0055 D6 for the DEPLOYED path only. The local
    // operator path is not deleted and not relaxed.
    const local = readFileSync(LOCAL, 'utf8');
    // ⚠️ The FULL signature, not the name: a renamed `assertLocalDatabaseTargetX`
    // still contains the old name as a substring, and this guard passed against
    // exactly that mutation until it was made to fail.
    expect(local).toContain('export function assertLocalDatabaseTarget(url: string): void {');
    expect(local).toMatch(/const LOOPBACK_HOSTS: ReadonlySet<string> = new Set\(\[/);
    expect(stripComments(local)).not.toContain('private-interface');
  });

  it('is not imported, wrapped or re-implemented here', () => {
    // ⚠️ Importing it would make this package a relaxation of that rule rather
    // than a separate composition — the "second function that quietly permits"
    // shape §2 Q5 refuses by name.
    for (const file of FILES) {
      const source = stripComments(readFileSync(file, 'utf8'));
      expect(source, file).not.toContain('assertLocalDatabaseTarget');
      expect(source, file).not.toContain('local-database-target');
    }
  });

  it('never claims the deployed database is the operator’s own machine', () => {
    // 🛑 The whole design is being HONEST about being remote. A message that
    // called this "local" would undo the ADR in a sentence.
    expect(POLICY).not.toMatch(/is local\b/);
    expect(POLICY).not.toContain('the operator controls');
  });
});

describe('the package is not an authorization and has no caller yet', () => {
  it('does not call askEntitlement', () => {
    // 🚫 Where a row may be stored is not who may read it (A2/A3). And a caller
    // here would silently discharge a question that is still open.
    for (const file of FILES) {
      expect(stripComments(readFileSync(file, 'utf8')), file).not.toContain('askEntitlement');
    }
  });

  it('is imported by nothing on the deployment path yet', () => {
    // ⚠️ A6 gates the deployment slice. If this guard fails because a real
    // composition now imports the package, the fix is to update it deliberately
    // in that slice — never to delete it.
    const importers = searchImporters(join(REPO, 'apps')).concat(
      searchImporters(join(REPO, 'packages')).filter(
        (file) => !file.includes('deployed-database-target'),
      ),
    );

    expect(importers).toEqual([]);
  });
});

function searchImporters(root: string): string[] {
  let scanned = 0;
  const found: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.nx') continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!full.endsWith('.ts')) continue;
      scanned += 1;
      if (readFileSync(full, 'utf8').includes("'@age/deployed-database-target'")) {
        found.push(full);
      }
    }
  };

  walk(root);

  // ⚠️ The walk asserts it examined something: an empty scan reporting "no
  // callers" would be a guard that passes because it looked nowhere.
  expect(scanned).toBeGreaterThan(50);

  return found;
}
