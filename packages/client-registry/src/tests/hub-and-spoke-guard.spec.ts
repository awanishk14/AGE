import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { clientRecordSchema } from '../client-record';

/**
 * ADR-0054 D5 — hub and spoke, ENFORCED rather than described.
 *
 * The user's decision, verbatim (ADR-0054 §0.2): _"i also want hub and spoke
 * only, and no tools should interact with each other"_. Doc 11 §2.1.1 rule 4
 * and Doc 12 §6.1 constraint 4 say what that obliges: a peer product never
 * interacts with another peer product, cross-product insight is produced only
 * by AGE reasoning over a shared BIF, and a handover never chains.
 *
 * ⚠️ WHAT THIS GUARD IS EVIDENCE ABOUT — read before citing it.
 * It is evidence about **this repository only**. The Product Owner upheld the
 * dissent verbatim (ADR-0054 §0.1c): _"AGE can enforce that it never chains
 * peer products together. It cannot mechanically prevent RankOps from later
 * calling MCP Ads internally. That remains an architectural governance rule
 * across products rather than something AGE alone can enforce."_
 * 🚫 This file must NEVER be described as proving anything about a peer
 * product's own code, and the dissent it is bounded by must not be softened or
 * marked mitigated.
 *
 * ⚠️ Why it lives in `@age/client-registry`: `externalRefs` is the only
 * representation of a peer product anywhere inside AGE. Naming a peer product
 * as DATA is exactly what Doc 11 permits; reaching one as CODE is what these
 * rules forbid. The guard therefore checks the difference, which is why it sits
 * beside the type that holds the data.
 *
 * ⚠️ Guard-test pattern: the walk asserts it found files first, comments are
 * stripped before scanning, and the count examined is asserted — so an empty
 * scan can never report compliance.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');

/**
 * The peer products named in the accepted ADRs (ADR-0053, ADR-0054 D4). Matched
 * case-insensitively and as a substring, which over-matches rather than
 * under-matches — the fail-closed direction.
 */
const PEER_PRODUCTS = ['mcp-ads', 'rankops'];

const EXCLUDED_SEGMENTS = new Set(['node_modules', 'dist', '.turbo']);

function walk(dir: string, keep: (file: string) => boolean): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (EXCLUDED_SEGMENTS.has(entry)) return [];
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full, keep) : keep(full) ? [full] : [];
  });
}

const ROOTS = ['packages', 'apps'].map((dir) => join(REPO_ROOT, dir)).filter(existsSync);

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Module specifiers a file imports or requires. */
function importedSpecifiers(source: string): string[] {
  return [...stripComments(source).matchAll(/(?:from|require\()\s*['"]([^'"]+)['"]/g)].map(
    (match) => match[1] ?? '',
  );
}

/** Absolute URLs a file contains, whatever they are used for. */
function urlLiterals(source: string): string[] {
  return [...stripComments(source).matchAll(/https?:\/\/[^\s'"`)]+/g)].map((match) => match[0]);
}

/** Environment variable names a file reads. */
function environmentVariables(source: string): string[] {
  return [
    ...stripComments(source).matchAll(/process\.env(?:\.([A-Za-z0-9_]+)|\[['"]([^'"]+)['"]\])/g),
  ].map((match) => match[1] ?? match[2] ?? '');
}

function namesAPeerProduct(text: string): boolean {
  const lowered = text.toLowerCase();
  return PEER_PRODUCTS.some((peer) => lowered.includes(peer));
}

describe('AGE does not reach a peer product as code (ADR-0054 D5, Doc 11 §2.1.1 rule 4)', () => {
  // ⚠️ `.spec.ts` files are excluded from the scan on purpose — THIS file names
  // both peer products, and a guard that its own text failed would be deleted
  // rather than obeyed.
  const files = ROOTS.flatMap((root) =>
    walk(root, (file) => file.endsWith('.ts') && !file.endsWith('.spec.ts')),
  );

  it('found the repository source tree to scan', () => {
    expect(ROOTS).toHaveLength(2);
    expect(files.length).toBeGreaterThan(50);
  });

  it('imports no peer product from any source file', () => {
    // 🚫 An import would make AGE depend on a peer product's internals rather
    // than its published contract (Doc 11 §2.1.1 rule 2), reversing the
    // dependency arrow by accident.
    let examined = 0;
    for (const file of files) {
      examined += 1;
      const offending = importedSpecifiers(readFileSync(file, 'utf8')).filter(namesAPeerProduct);
      expect({ file, offending }).toEqual({ file, offending: [] });
    }
    expect(examined).toBe(files.length);
  });

  it('contains no URL addressing a peer product', () => {
    // 🚫 Calling a peer product from anywhere in AGE would breach Doc 12 §6.1
    // constraint 2 — no layer above the Execution Layer may hand anything over
    // — and there is no Execution Layer here to do it legitimately.
    let examined = 0;
    for (const file of files) {
      examined += 1;
      const offending = urlLiterals(readFileSync(file, 'utf8')).filter(namesAPeerProduct);
      expect({ file, offending }).toEqual({ file, offending: [] });
    }
    expect(examined).toBe(files.length);
  });

  it('reads no environment variable naming a peer product', () => {
    // 🚫 Credential locality (Doc 11 §6.1): AGE stores a REFERENCE to route a
    // handover, never the secret. A peer-product env var is how a credential
    // arrives in practice.
    let examined = 0;
    for (const file of files) {
      examined += 1;
      const offending = environmentVariables(readFileSync(file, 'utf8')).filter(namesAPeerProduct);
      expect({ file, offending }).toEqual({ file, offending: [] });
    }
    expect(examined).toBe(files.length);
  });

  it('declares no peer product as a dependency in any package manifest', () => {
    // A dependency is the form the breach would most plausibly take first, and
    // it would not appear in any `.ts` file until the day it was used.
    const manifests = ROOTS.flatMap((root) =>
      walk(root, (file) => file.endsWith('package.json')),
    ).concat(join(REPO_ROOT, 'package.json'));

    expect(manifests.length).toBeGreaterThan(10);

    for (const manifest of manifests) {
      const declared = JSON.parse(readFileSync(manifest, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const names = [
        ...Object.keys(declared.dependencies ?? {}),
        ...Object.keys(declared.devDependencies ?? {}),
      ];
      const offending = names.filter(namesAPeerProduct);
      expect({ manifest, offending }).toEqual({ manifest, offending: [] });
    }
  });
});

describe('a peer product may be NAMED as data, and only as data', () => {
  it('keeps the record shape to identity plus references', () => {
    // ⚠️ `externalRefs` is a reference map: "what is this business called
    // elsewhere". 🚫 The moment a credential-shaped field appears beside it,
    // AGE has become the thing Doc 11 §6.1 forbids — the holder of a peer
    // product's secret. The schema is `.strict()`, so this key set is the whole
    // record.
    const keys = Object.keys(clientRecordSchema.shape).sort();
    expect(keys).toEqual(['clientId', 'displayName', 'externalRefs', 'organizationId']);

    const credentialShaped = /secret|token|password|credential|apikey|refresh/i;
    expect(keys.filter((key) => credentialShaped.test(key))).toEqual([]);
  });

  it('lets a record name a peer product without AGE being able to call it', () => {
    // This is the whole hub-and-spoke shape in one assertion: the reference
    // parses, and nothing above turned it into reachability.
    const record = clientRecordSchema.parse({
      clientId: 'client-fictional-1',
      organizationId: 'org-fictional-1',
      displayName: 'Wholly Invented Widgets (FICTIONAL)',
      externalRefs: { rankops: 'rankops-client-example-001' },
    });

    expect(record.externalRefs.rankops).toBe('rankops-client-example-001');
  });
});
