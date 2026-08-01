import { describe, expect, it } from 'vitest';

import {
  isOperatorPrincipal,
  operatorPrincipal,
  parseOperatorPrincipal,
} from '../operator-principal';

describe('operatorPrincipal', () => {
  it('builds a prefixed principal from a handle', () => {
    expect(operatorPrincipal('awanish')).toBe('operator:awanish');
  });

  it.each([
    ['UPPER'],
    [' leading'],
    ['trailing '],
    [''],
    ['-starts-with-separator'],
    ['has space'],
  ])('rejects the malformed handle %j rather than normalising it', (handle) => {
    // Normalising would make one person look like two in permanent
    // provenance, which is the failure this constraint exists to prevent.
    expect(() => operatorPrincipal(handle)).toThrow();
  });
});

describe('parseOperatorPrincipal', () => {
  it('accepts a well-formed principal', () => {
    expect(parseOperatorPrincipal('operator:awanish')).toBe('operator:awanish');
  });

  it.each([
    ['a bare handle with no prefix', 'awanish'],
    ['a different principal kind', 'user:awanish'],
    ['a system-sounding value', 'system'],
    ['an empty handle', 'operator:'],
    ['undefined', undefined],
    ['null', null],
  ])('rejects %s', (_label, value) => {
    expect(() => parseOperatorPrincipal(value)).toThrow(/never defaulted, generated or inferred/);
  });

  it('has no default, no fallback and no anonymous principal (ADR-0053 D4)', async () => {
    // 🚫 A caller that cannot name the operator must fail. If an export
    // appears here that supplies one, provenance has started lying.
    const module = await import('../operator-principal');
    const exported = Object.keys(module);
    expect(exported).not.toContain('SYSTEM_PRINCIPAL');
    expect(exported).not.toContain('ANONYMOUS_PRINCIPAL');
    expect(exported).not.toContain('operatorPrincipalOrDefault');
    expect(exported.some((name) => /default|fallback|anonymous|system/i.test(name))).toBe(false);
  });
});

describe('isOperatorPrincipal', () => {
  it('narrows a valid value and rejects an invalid one', () => {
    expect(isOperatorPrincipal('operator:awanish')).toBe(true);
    expect(isOperatorPrincipal('operator:Awanish')).toBe(false);
    expect(isOperatorPrincipal(42)).toBe(false);
  });
});
