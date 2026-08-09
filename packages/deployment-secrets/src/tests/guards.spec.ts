import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..');
const REPO = join(SRC, '..', '..', '..');

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
const sources = () =>
  FILES.map((file) => [file, stripComments(readFileSync(file, 'utf8'))] as const);

describe('the package decides and performs nothing', () => {
  it('found source files to scan', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(2);
  });

  it.each([
    'process.env',
    'process.exit',
    'node:fs',
    'readFileSync',
    'fetch(',
    'console.',
    'new Date(',
    'Math.random(',
    '@prisma/client',
  ])('contains no %s', (token) => {
    let examined = 0;
    for (const [file, source] of sources()) {
      examined += 1;
      expect(source, file).not.toContain(token);
    }
    expect(examined).toBe(FILES.length);
  });

  it('mints nothing', () => {
    // 🚫 "Generate one if it is missing" is the shortcut this package exists to
    // refuse: a generated secret is a secret nobody can rotate, because nobody
    // knows it. The absence of `node:crypto` is how that is enforced.
    for (const [file, source] of sources()) {
      expect(source, file).not.toContain('node:crypto');
      expect(source, file).not.toContain('randomBytes');
      expect(source, file).not.toContain('randomUUID');
    }
  });
});

describe('there is no default, and no way to add one quietly', () => {
  const secrets = stripComments(readFileSync(join(SRC, 'deployment-secrets.ts'), 'utf8'));

  it.each(['DEFAULT_', 'FALLBACK', 'dev-secret', 'changeme', 'placeholder'])(
    'declares no %s',
    (token) => {
      for (const [file, source] of sources()) {
        expect(source.toLowerCase(), file).not.toContain(token.toLowerCase());
      }
    },
  );

  it('never substitutes a value for an absent one', () => {
    // ⚠️ `??` and `||` are how a default arrives — as one character, in a diff
    // nobody reads twice.
    expect(secrets).not.toMatch(/environment\[[^\]]+\]\s*(\?\?|\|\|)/);
    expect(secrets).not.toMatch(/=\s*environment\.\w+\s*(\?\?|\|\|)/);
  });

  it('has no escape hatch', () => {
    for (const [file, source] of sources()) {
      expect(source.toLowerCase(), file).not.toContain('skip');
      expect(source.toLowerCase(), file).not.toContain('optional');
      expect(source.toLowerCase(), file).not.toContain('allowmissing');
      expect(source.toLowerCase(), file).not.toContain('dangerously');
    }
  });

  it('treats a blank value as absent, in exactly one place', () => {
    expect(secrets).toContain("value === undefined || value.trim() === ''");
    expect(secrets.match(/function isAbsent/g)).toHaveLength(1);
  });

  it('refuses with every missing name, not the first', () => {
    // 🚫 A first-one-wins refusal teaches fix–redeploy–fail–fix, and each cycle
    // is a chance to reach for the shortcut above.
    expect(secrets).toContain('missing.join');
    expect(secrets).not.toMatch(/missing\[0\]/);
  });
});

describe('the refusal carries no secret', () => {
  const secrets = stripComments(readFileSync(join(SRC, 'deployment-secrets.ts'), 'utf8'));

  it('the error type holds names, never values', () => {
    expect(secrets).toContain('readonly missing: readonly string[];');
    expect(secrets).not.toMatch(/readonly value/);
  });

  it('never measures or slices a value', () => {
    // ⚠️ A length is a lead and a prefix is still a secret.
    expect(secrets).not.toMatch(/\.length\b[^;]*\bvalue\b/);
    expect(secrets).not.toContain('.slice(');
    expect(secrets).not.toContain('.substring(');
    expect(secrets).not.toContain('redact');
  });
});

describe('nothing calls it yet', () => {
  function repoFiles(dir: string, depth = 0): string[] {
    if (depth > 6) return [];
    return readdirSync(dir).flatMap((entry) => {
      if (['node_modules', 'dist', '.git', '.next', 'coverage'].includes(entry)) return [];
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return repoFiles(full, depth + 1);
      return full.endsWith('.ts') || full.endsWith('.tsx') ? [full] : [];
    });
  }

  it('is imported by no application or package outside itself', () => {
    // ⚠️ Wiring this is the deployment composition's job (A6 item 1), and that
    // is its own slice. A caller here would make an unreviewed composition the
    // place the deployment's startup rule actually lives.
    const scanned = [join(REPO, 'apps'), join(REPO, 'packages')].flatMap((root) => repoFiles(root));

    expect(scanned.length).toBeGreaterThan(50);

    const importers = scanned.filter(
      (file) =>
        !file.includes(join('packages', 'deployment-secrets')) &&
        stripComments(readFileSync(file, 'utf8')).includes('@age/deployment-secrets'),
    );

    expect(importers).toEqual([]);
  });
});
