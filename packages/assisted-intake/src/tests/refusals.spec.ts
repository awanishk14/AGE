import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as api from '../index';

/**
 * The refusals ADR-0059 buys its own authorization with, asserted against the
 * package's source rather than against its documentation.
 *
 * ⚠️ MADE TO FAIL BEFORE THEY WERE TRUSTED: adding a `fetch(` to
 * `load-source-document.ts` fails the egress guard by file name; exporting an
 * `acceptAllPassages` fails the bulk-acceptance guard by symbol name; adding a
 * `confidence: z.number()` to a passage fails the D3 guard.
 */

const SOURCE_DIR = resolve(process.cwd(), 'src');

/**
 * ⚠️ Comments are stripped first. This package explains at length why it does
 * not fetch and does not call a model, and a guard that fails on its own
 * explanation gets deleted rather than fixed.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const MODULES = readdirSync(SOURCE_DIR)
  .filter((name) => name.endsWith('.ts'))
  .map((name) => ({ name, source: withoutComments(readFileSync(join(SOURCE_DIR, name), 'utf8')) }));

describe('@age/assisted-intake refusals', () => {
  it('scanned the modules it claims to have scanned', () => {
    // ⚠️ A walk that found nothing would report perfect compliance.
    expect(MODULES.length).toBeGreaterThanOrEqual(5);
    expect(MODULES.map((module) => module.name)).toContain('load-source-document.ts');
  });

  it('reaches no network and listens on nothing (D4.3, D4.4, D5)', () => {
    // 🚫 D4.3 is refused PENDING ITS OWN ADR — an SSRF surface in a process
    // that reads the operator's filesystem. D4.4 is refused outright. D5 is a
    // disclosure decision, not a capability one.
    for (const { name, source } of MODULES) {
      for (const banned of [
        'fetch(',
        'node:http',
        'node:https',
        'XMLHttpRequest',
        'WebSocket',
        '.listen(',
        'anthropic',
        'openai',
      ]) {
        expect(source.toLowerCase(), `${name} must not contain ${banned}`).not.toContain(
          banned.toLowerCase(),
        );
      }
    }
  });

  it('performs no I/O and decodes no document format itself', () => {
    // ⚠️ The read is INJECTED. 🚫 A decoder dependency needs the follow-up ADR
    // D4.2 requires, and it would arrive as an import here first.
    for (const { name, source } of MODULES) {
      for (const banned of ['node:fs', 'node:path', 'new Date(', 'Math.random(', 'process.env']) {
        expect(source, `${name} must not contain ${banned}`).not.toContain(banned);
      }

      // A decoder would arrive as an import, and the words "PDF" and "DOCX"
      // legitimately appear in the sentence that REFUSES to decode one, so the
      // check is on import specifiers rather than on the whole file.
      const imported = [...source.matchAll(/from '([^']+)'/g)].map((match) => match[1] ?? '');
      expect(imported, name).not.toContain('mammoth');
      for (const specifier of imported) {
        expect(specifier.toLowerCase(), name).not.toMatch(/pdf|docx|office/);
      }
    }
  });

  it('carries no number expressing certainty (D3)', () => {
    for (const { name, source } of MODULES) {
      for (const banned of ['z.number(', 'confidence', 'score']) {
        expect(source.toLowerCase(), `${name} must not contain ${banned}`).not.toContain(banned);
      }
    }
  });

  it('exposes no bulk acceptance and no threshold (D1)', () => {
    // 🚫 The signature is the enforcement: nothing takes many passages, and
    // nothing returns many answers. A loop is trivial to add and invisible in
    // review, so the absence is asserted rather than assumed.
    for (const exported of Object.keys(api)) {
      expect(exported.toLowerCase()).not.toMatch(/all|bulk|each|every|threshold|auto/);
    }

    const accept = withoutComments(readFileSync(join(SOURCE_DIR, 'accept-passage.ts'), 'utf8'));
    expect(accept).not.toMatch(/\.map\(|\.forEach\(|for \(/);
    expect(accept).toContain('passage: SourcePassage');
  });

  it('exports exactly one way to turn a passage into an answer', () => {
    const accepting = Object.keys(api).filter((name) => name.toLowerCase().includes('accept'));

    expect(accepting).toEqual(['PassageAcceptanceRefusedError', 'acceptPassageAsAnswer']);
  });
});
