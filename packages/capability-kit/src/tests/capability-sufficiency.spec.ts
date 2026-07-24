import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Capability, ExecutionDomain } from '../enums';
import * as packageEntrypoint from '../index';
import { CapabilityOutput } from '../outputs/capability-output';
import type { CapabilityOutputItem } from '../outputs/capability-output-item';
import {
  CAPABILITY_SUFFICIENCY_STATES,
  CapabilitySufficiencyState,
  createCapabilitySufficiency,
  type CapabilitySufficiency,
} from '../outputs/capability-sufficiency';

interface TestItem extends CapabilityOutputItem {
  title: string;
}

const PRODUCED_AT = new Date('2026-07-15T09:30:00.000Z');

const buildOutput = (sufficiency?: CapabilitySufficiency): CapabilityOutput<TestItem> =>
  new CapabilityOutput<TestItem>({
    clientId: 'client-1',
    organizationId: 'org-1',
    capability: Capability.Intelligence,
    executionDomains: [ExecutionDomain.SEO],
    items: [],
    producedAt: PRODUCED_AT,
    ...(sufficiency === undefined ? {} : { sufficiency }),
  });

describe('CapabilitySufficiencyState (ADR-0026, Decision 3)', () => {
  it('is exactly the four ADR-0026 states', () => {
    expect(CAPABILITY_SUFFICIENCY_STATES).toEqual([
      CapabilitySufficiencyState.Ready,
      CapabilitySufficiencyState.Partial,
      CapabilitySufficiencyState.Insufficient,
      CapabilitySufficiencyState.Blocked,
    ]);
    expect(Object.values(CapabilitySufficiencyState)).toEqual([
      'ready',
      'partial',
      'insufficient',
      'blocked',
    ]);
  });

  it.each(CAPABILITY_SUFFICIENCY_STATES)('supports the %s state end to end', (state) => {
    const sufficiency = createCapabilitySufficiency({
      state,
      reasons: [`state is ${state} because the caller said so`],
    });
    const output = buildOutput(sufficiency);
    expect(output.sufficiency?.state).toBe(state);
    expect(output.sufficiency?.reasons).toHaveLength(1);
  });
});

describe('createCapabilitySufficiency', () => {
  it('carries reasons, warnings and context quality notes through', () => {
    const sufficiency = createCapabilitySufficiency({
      state: CapabilitySufficiencyState.Partial,
      reasons: ['two of twelve context sections were present', 'no competitor data was supplied'],
      warnings: ['scoring version differs from the expected one'],
      contextQualityNotes: ['all present fields were self-reported, none independently sourced'],
    });

    expect(sufficiency.reasons).toEqual([
      'two of twelve context sections were present',
      'no competitor data was supplied',
    ]);
    expect(sufficiency.warnings).toEqual(['scoring version differs from the expected one']);
    expect(sufficiency.contextQualityNotes).toEqual([
      'all present fields were self-reported, none independently sourced',
    ]);
  });

  it('carries reasons and warnings through the output envelope unchanged', () => {
    const sufficiency = createCapabilitySufficiency({
      state: CapabilitySufficiencyState.Insufficient,
      reasons: ['no offering section was supplied'],
      warnings: ['context confidence was low'],
    });
    const output = buildOutput(sufficiency);

    expect(output.sufficiency).toBe(sufficiency);
    expect(output.sufficiency?.reasons).toEqual(['no offering section was supplied']);
    expect(output.sufficiency?.warnings).toEqual(['context confidence was low']);
  });

  it('defaults warnings to empty and leaves context quality notes absent', () => {
    const sufficiency = createCapabilitySufficiency({
      state: CapabilitySufficiencyState.Ready,
      reasons: ['every required section was present'],
    });
    expect(sufficiency.warnings).toEqual([]);
    // Absent, not empty: "no notes supplied" stays distinct from "empty notes".
    expect('contextQualityNotes' in sufficiency).toBe(false);
  });

  it('copies input arrays so the result cannot be mutated through the caller', () => {
    const reasons: [string, ...string[]] = ['first reason'];
    const warnings = ['first warning'];
    const sufficiency = createCapabilitySufficiency({
      state: CapabilitySufficiencyState.Partial,
      reasons,
      warnings,
    });

    reasons.push('added later');
    warnings.push('added later');

    expect(sufficiency.reasons).toEqual(['first reason']);
    expect(sufficiency.warnings).toEqual(['first warning']);
  });

  it('rejects construction with no reasons — sufficiency must be explainable', () => {
    expect(() =>
      createCapabilitySufficiency({
        state: CapabilitySufficiencyState.Ready,
        reasons: [] as unknown as [string, ...string[]],
      }),
    ).toThrow(/at least one reason/);
  });

  it('rejects an unknown state', () => {
    expect(() =>
      createCapabilitySufficiency({
        state: 'almost-ready' as CapabilitySufficiencyState,
        reasons: ['nonsense'],
      }),
    ).toThrow(/unknown state/);
  });
});

describe('insufficient and blocked semantics (ADR-0026)', () => {
  it('treats insufficient as a successful, informative output — never an error', () => {
    const sufficiency = createCapabilitySufficiency({
      state: CapabilitySufficiencyState.Insufficient,
      reasons: ['the supplied context contained no offering or customer sections'],
    });
    // Constructing it does not throw, and it produces a normal output envelope.
    const output = buildOutput(sufficiency);

    expect(output).toBeInstanceOf(CapabilityOutput);
    expect(output.sufficiency?.state).toBe(CapabilitySufficiencyState.Insufficient);
    expect(output.items).toEqual([]);
    // Missing context is recorded as a limitation, not as a finding about the
    // business — the capability produced no items rather than negative ones.
    expect(output.sufficiency?.reasons[0]).toContain('contained no');
  });

  it('represents blocked distinctly from insufficient', () => {
    const insufficient = createCapabilitySufficiency({
      state: CapabilitySufficiencyState.Insufficient,
      reasons: ['context too thin to conclude'],
    });
    const blocked = createCapabilitySufficiency({
      state: CapabilitySufficiencyState.Blocked,
      reasons: ['a caller-declared precondition was not met'],
    });

    expect(blocked.state).not.toBe(insufficient.state);
    expect(blocked.state).toBe('blocked');
    expect(insufficient.state).toBe('insufficient');
  });
});

describe('backward compatibility', () => {
  it('leaves sufficiency undefined when the caller omits it', () => {
    const output = buildOutput();
    expect(output.sufficiency).toBeUndefined();
    // Not defaulted to `ready`: an envelope told nothing about context has no
    // basis to claim readiness (ADR-0026, Decision 4).
    expect(output.sufficiency?.state).toBeUndefined();
  });

  it('keeps every pre-existing output field intact when sufficiency is supplied', () => {
    const output = buildOutput(
      createCapabilitySufficiency({
        state: CapabilitySufficiencyState.Ready,
        reasons: ['all required context present'],
      }),
    );
    expect(output.clientId).toBe('client-1');
    expect(output.organizationId).toBe('org-1');
    expect(output.capability).toBe(Capability.Intelligence);
    expect(output.executionDomains).toEqual([ExecutionDomain.SEO]);
    expect(output.producedAt).toBe(PRODUCED_AT);
  });

  it('does not change item-level createdAt semantics', () => {
    const createdAt = new Date('2026-07-15T09:00:00.000Z');
    const item: TestItem = {
      id: 'item-1',
      capability: Capability.Intelligence,
      createdAt,
      title: 'Test opportunity',
    };
    const output = new CapabilityOutput<TestItem>({
      clientId: 'client-1',
      organizationId: 'org-1',
      capability: Capability.Intelligence,
      executionDomains: [ExecutionDomain.SEO],
      items: [item],
      producedAt: PRODUCED_AT,
      sufficiency: createCapabilitySufficiency({
        state: CapabilitySufficiencyState.Partial,
        reasons: ['only one candidate survived validation'],
      }),
    });
    // createdAt remains caller-supplied; sufficiency does not touch it.
    expect(output.items[0]!.createdAt).toBe(createdAt);
  });
});

describe('determinism and scope', () => {
  it('produces identical sufficiency data from identical inputs', () => {
    const build = () =>
      createCapabilitySufficiency({
        state: CapabilitySufficiencyState.Partial,
        reasons: ['seven of twelve sections present'],
        warnings: ['one section was omitted'],
        contextQualityNotes: ['no independently sourced fields'],
      });
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
    expect(build()).not.toBe(build());
  });

  it('produces an identical output envelope when producedAt and sufficiency are supplied', () => {
    const build = () =>
      buildOutput(
        createCapabilitySufficiency({
          state: CapabilitySufficiencyState.Insufficient,
          reasons: ['no usable context'],
        }),
      );
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });

  it('reads no clock, randomness or environment (purity guard)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, '..', 'outputs', 'capability-sufficiency.ts'), 'utf8');
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    for (const forbidden of [
      'new Date(',
      'Date.now(',
      'Math.random(',
      'performance.now(',
      'fetch(',
      'node:fs',
      'process.env',
    ]) {
      expect(code.includes(forbidden), `sufficiency source must not contain ${forbidden}`).toBe(
        false,
      );
    }
  });

  it('introduces no threshold or scoring policy', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, '..', 'outputs', 'capability-sufficiency.ts'), 'utf8');
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    // No score/threshold vocabulary, and no state is derived from a number:
    // the caller decides the state, this module only carries it.
    for (const forbidden of ['THRESHOLD', 'threshold', 'confidenceScore', 'completenessScore']) {
      expect(code.includes(forbidden), `sufficiency source must not contain ${forbidden}`).toBe(
        false,
      );
    }
  });

  it('does not couple the shared contract to any context source', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, '..', 'outputs', 'capability-sufficiency.ts'), 'utf8');
    const imports = source.split('\n').filter((line) => line.trim().startsWith('import'));
    // No imports at all: no @age/bif, no ScoredBifContext, nothing. The prose
    // may name them (to say they are out of scope); the code may not.
    expect(imports).toEqual([]);
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    expect(code.includes('ScoredBifContext')).toBe(false);
    expect(code.includes('@age/bif')).toBe(false);
  });

  it('is exported from the package entrypoint', () => {
    expect(packageEntrypoint.CapabilitySufficiencyState).toBe(CapabilitySufficiencyState);
    expect(packageEntrypoint.CAPABILITY_SUFFICIENCY_STATES).toBe(CAPABILITY_SUFFICIENCY_STATES);
    expect(packageEntrypoint.createCapabilitySufficiency).toBe(createCapabilitySufficiency);
  });
});
