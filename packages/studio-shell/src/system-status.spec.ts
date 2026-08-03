import { describe, expect, it } from 'vitest';

import { presentSystemStatus, type SystemStatusInput } from './system-status';

const input = (overrides: Partial<SystemStatusInput> = {}): SystemStatusInput => ({
  bindHost: '127.0.0.1',
  bindPort: 3100,
  recordFile: 'not-configured',
  identity: 'not-established',
  captureStore: 'not-read',
  ...overrides,
});

const facet = (id: string, source: SystemStatusInput = input()) => {
  const found = presentSystemStatus(source).find((entry) => entry.id === id);
  if (found === undefined) {
    throw new Error(`no facet "${id}"`);
  }
  return found;
};

describe('presentSystemStatus', () => {
  it('reports every facet it claims to', () => {
    const ids = presentSystemStatus(input()).map((entry) => entry.id);

    expect(ids).toEqual(['bind', 'identity', 'capture-store', 'record-file', 'execution']);
  });

  describe('identity (ADR-0058 D2)', () => {
    it('is NEVER shown as healthy or established', () => {
      const identity = facet('identity');

      expect(identity.value).toBe('Not established');
      // 🚫 `known` renders as a working subsystem. Identity does not exist.
      expect(identity.state).toBe('not-assessed');
    });

    it('says nobody is signed in AND nobody is signed out', () => {
      // ⚠️ The third value is the whole decision. If this sentence is ever
      // simplified to "not signed in", identity has quietly become a boolean.
      expect(facet('identity').detail).toContain('nobody is signed out');
    });
  });

  describe('capture store (ADR-0058 D6, ADR-0055 D7)', () => {
    it('reads "Not read" and never "Never"', () => {
      const captureStore = facet('capture-store');

      expect(captureStore.value).toBe('Not read');
      expect(captureStore.value).not.toContain('Never');
      expect(captureStore.state).toBe('not-assessed');
    });

    it('distinguishes itself from "no snapshots"', () => {
      expect(facet('capture-store').detail).toContain('nothing has looked');
    });
  });

  describe('bind host', () => {
    it('reports what was bound', () => {
      expect(facet('bind', input({ bindHost: '127.0.0.1', bindPort: 3100 })).value).toBe(
        '127.0.0.1:3100',
      );
    });

    it('never claims the console is unreachable', () => {
      // ⚠️ Loopback is NECESSARY, NOT SUFFICIENT. A proxy or tunnel defeats it.
      const detail = facet('bind').detail;

      expect(detail).toContain('necessary, not sufficient');
      expect(detail).not.toMatch(/unreachable|cannot be reached|guarantee/i);
    });
  });

  describe('client records', () => {
    it('is NOT ASSESSED when no path was configured', () => {
      const recordFile = facet('record-file', input({ recordFile: 'not-configured' }));

      expect(recordFile.value).toBe('Not configured');
      expect(recordFile.state).toBe('not-assessed');
      expect(recordFile.detail).toContain('not "no businesses"');
    });

    it('treats a refusal as a RESULT, not as "not looked"', () => {
      expect(facet('record-file', input({ recordFile: 'refused' })).state).toBe('unknown');
    });

    it('is KNOWN only once a file was actually read', () => {
      expect(facet('record-file', input({ recordFile: 'read' })).state).toBe('known');
    });
  });

  describe('business execution', () => {
    it('states the refusal and names AGE-initiated action as part of it', () => {
      const execution = facet('execution');

      expect(execution.value).toBe('Refused');
      // ⚠️ This is the one that gets argued away: internal-only effects that
      // AGE initiates are still class 3.
      expect(execution.detail).toMatch(/schedule, a retry, a background recompute/);
    });

    it('never describes the console as read-only', () => {
      // 🚫 ADR-0057 §0.7 RETIRED the term.
      for (const entry of presentSystemStatus(input())) {
        expect(`${entry.label} ${entry.value} ${entry.detail}`).not.toMatch(/read-only/i);
      }
    });
  });

  it('returns frozen facets', () => {
    const facets = presentSystemStatus(input());

    expect(Object.isFrozen(facets)).toBe(true);
    expect(facets.every((entry) => Object.isFrozen(entry))).toBe(true);
  });
});
