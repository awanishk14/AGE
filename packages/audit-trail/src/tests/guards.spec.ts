import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..');

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
const ENTRY = stripComments(readFileSync(join(SRC, 'audit-entry.ts'), 'utf8'));
const RETRIEVAL = stripComments(readFileSync(join(SRC, 'audit-retrieval.ts'), 'utf8'));

describe('the package records and performs nothing', () => {
  it('found source files to scan', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(3);
  });

  it.each([
    'process.env',
    'node:fs',
    'fetch(',
    'new Date(',
    'Date.now(',
    'Math.random(',
    'randomUUID',
    'console.',
    '@prisma/client',
    '@age/persistence',
  ])('contains no %s', (token) => {
    let examined = 0;
    for (const file of FILES) {
      examined += 1;
      expect(stripComments(readFileSync(file, 'utf8')), file).not.toContain(token);
    }
    expect(examined).toBe(FILES.length);
  });

  it('mints no identifier and reads no clock', () => {
    // ⚠️ Both arrive as parameters, so an entry's instant is the deployment's
    // one clock rather than this module's opinion of the time.
    expect(ENTRY).toContain('readonly occurredAt: string;');
    expect(ENTRY).toContain('readonly entryId: string;');
  });
});

describe('there is no way to turn it off', () => {
  it.each(['enabled', 'disable', 'auditlevel', 'verbosity', 'sample', 'ifenabled', 'optout'])(
    'declares no %s',
    (token) => {
      // 🚫 A recorder with a switch is a recorder that is off during the
      // incident.
      for (const file of FILES) {
        expect(stripComments(readFileSync(file, 'utf8')).toLowerCase(), file).not.toContain(token);
      }
    },
  );

  it('offers no edit, redaction or deletion', () => {
    for (const token of ['redact', 'anonymize', 'anonymise', 'delete', 'update', 'amend']) {
      expect(ENTRY.toLowerCase(), token).not.toContain(token);
    }
  });

  it('freezes what it returns', () => {
    expect(ENTRY).toContain('Object.freeze({');
    expect(ENTRY.match(/Object\.freeze\(/g)?.length).toBeGreaterThanOrEqual(4);
  });
});

describe('a failure is recorded as loudly as a success', () => {
  it('declares both authentication events', () => {
    expect(ENTRY).toContain("'authentication-succeeded'");
    expect(ENTRY).toContain("'authentication-failed'");
  });

  it('refuses to name an account on a failure', () => {
    // 🚫 A failure proved nothing about who was at the other end.
    expect(ENTRY).toContain("event === 'authentication-failed' && actor.accountId !== null");
  });

  it('has no arm that skips recording a failure', () => {
    expect(ENTRY).not.toMatch(/if\s*\(\s*[^)]*failed[^)]*\)\s*\{\s*return;/);
  });
});

describe('an entry carries no secret and no copy of the data', () => {
  it.each([
    'password',
    'token',
    'tokenhash',
    'secret',
    'credential',
    'cookie',
    'snapshot',
    'payload',
    'answers',
    'contents',
  ])('forbids a field named %s', (field) => {
    expect(ENTRY).toContain(`'${field}'`);
  });

  it('checks the field names rather than trusting the types', () => {
    // ⚠️ The type system stops today's call sites; this stops the one written
    // next year against a widened interface.
    expect(ENTRY).toContain('FORBIDDEN_FIELDS.includes(');
    expect(ENTRY).toContain('Object.keys(subject)');
  });

  it('normalizes a field name before comparing it', () => {
    // 🚫 `token_hash`, `tokenHash` and `TOKEN-HASH` are one field.
    expect(ENTRY).toContain("key.toLowerCase().replace(/[^a-z]/g, '')");
  });

  it('names the field but never interpolates a value', () => {
    const interpolations = ENTRY.match(/\$\{[^}]+\}/g) ?? [];

    expect(interpolations.length).toBeGreaterThan(0);
    for (const interpolation of interpolations) {
      expect(['${key}', '${where}', '${field}', '${String(event)}']).toContain(interpolation);
    }
  });
});

describe('an audit read is itself tenant-scoped', () => {
  it('takes the organization from the session type, which a string cannot satisfy', () => {
    expect(RETRIEVAL).toContain(
      "import type { AuthenticatedOrganizationId } from '@age/entitlement'",
    );
    expect(RETRIEVAL).toContain('readonly organizationId: AuthenticatedOrganizationId;');
    expect(RETRIEVAL).not.toContain('as AuthenticatedOrganizationId');
  });

  it('filters on the organization before anything else', () => {
    expect(RETRIEVAL).toContain('entry.actor.organizationId === query.organizationId');
    expect(RETRIEVAL.indexOf('entry.actor.organizationId')).toBeLessThan(
      RETRIEVAL.indexOf('entry.occurredAt >='),
    );
  });

  it('never attributes an unowned entry to the asker', () => {
    // 🛑 `?? query.organizationId` would hand one tenant another's evidence.
    expect(RETRIEVAL).not.toMatch(/organizationId\s*\?\?/);
    expect(RETRIEVAL).not.toContain('=== null ||');
  });

  it('has no admin arm', () => {
    // 🚫 ADR-0062 D3 — admin is never a bypass, in the trail either.
    for (const token of ['admin', 'superuser', 'allorganizations', 'bypass', 'override']) {
      expect(RETRIEVAL.toLowerCase(), token).not.toContain(token);
    }
  });

  it('does not answer the entitlement question', () => {
    for (const file of FILES) {
      expect(stripComments(readFileSync(file, 'utf8')), file).not.toContain('askEntitlement');
    }
  });
});
