import { describe, expect, it } from 'vitest';

import {
  answerFileNameFor,
  assertSafeClientIdForFileName,
  DISCOVERY_WORKSPACE_VARIABLE,
  draftFileNameFor,
  resolveDiscoveryWorkspace,
  UnsafeClientIdError,
} from './discovery-workspace';

describe('resolveDiscoveryWorkspace', () => {
  it('reports not-configured when the operator never named a directory', () => {
    expect(resolveDiscoveryWorkspace({})).toEqual({
      kind: 'not-configured',
      variable: DISCOVERY_WORKSPACE_VARIABLE,
    });
  });

  it('treats blank and whitespace as never-set, not as a malformed path', () => {
    for (const value of ['', '   ', '\t']) {
      expect(resolveDiscoveryWorkspace({ [DISCOVERY_WORKSPACE_VARIABLE]: value }).kind).toBe(
        'not-configured',
      );
    }
  });

  it('passes the directory through untrimmed', () => {
    // 🚫 Repairing a typo means writing somewhere the operator did not name.
    const result = resolveDiscoveryWorkspace({ [DISCOVERY_WORKSPACE_VARIABLE]: ' /tmp/age ' });
    expect(result).toEqual({ kind: 'configured', directory: ' /tmp/age ' });
  });

  it('never invents a default directory', () => {
    const result = resolveDiscoveryWorkspace({ HOME: '/home/someone', PWD: '/repo' });
    expect(result.kind).toBe('not-configured');
  });
});

describe('assertSafeClientIdForFileName', () => {
  it('accepts an ordinary identifier', () => {
    for (const id of ['acme-1', 'acme_1', 'a.b', 'A1']) {
      expect(() => assertSafeClientIdForFileName(id)).not.toThrow();
    }
  });

  /**
   * ⚠️ The load-bearing case. `clientId` comes from the URL; unchecked, it
   * addresses files outside the directory the operator named.
   */
  it('REFUSES anything that could escape the workspace', () => {
    for (const id of [
      '..',
      '../secrets',
      'a/../../b',
      'a/b',
      'a\\b',
      '/etc/passwd',
      'C:\\Windows',
      '.hidden',
      '',
      'a b',
      'a\0b',
    ]) {
      expect(() => assertSafeClientIdForFileName(id), `${id} must be refused`).toThrow(
        UnsafeClientIdError,
      );
    }
  });

  it('does not echo the offending id, which arrived from a URL', () => {
    let message = '';
    try {
      assertSafeClientIdForFileName('../<script>alert(1)</script>');
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).not.toContain('script');
    expect(message).toContain('Only letters, digits');
  });
});

describe('file names', () => {
  it('names the draft and the answer file distinctly', () => {
    expect(draftFileNameFor('acme-1')).toBe('acme-1.discovery-draft.json');
    expect(answerFileNameFor('acme-1')).toBe('acme-1.discovery-answers.json');
    expect(draftFileNameFor('acme-1')).not.toBe(answerFileNameFor('acme-1'));
  });

  it('refuses an unsafe id rather than composing a name from it', () => {
    expect(() => draftFileNameFor('../escape')).toThrow(UnsafeClientIdError);
    expect(() => answerFileNameFor('../escape')).toThrow(UnsafeClientIdError);
  });
});
