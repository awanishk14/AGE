import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  InMemoryScoredBifSnapshotRepository,
  type ScoredBifContext,
  type ScoredBifSnapshotRepository,
} from '@age/business-discovery-contracts';
import { ClientContext } from '@age/capability-kit';
import { describe, expect, it } from 'vitest';
import {
  ScoredBifSnapshotCaptureOrchestrator,
  type OrchestratedScoredBifSnapshotCaptureInput as OrchestratorInput,
} from '../scored-bif-snapshot-capture-orchestrator';
import { sampleContext } from './scored-bif-snapshot-repository-contract';

/**
 * ADR-0036: the orchestrator is the first caller of `ScoredBifSnapshotCapture`,
 * and it is the one place that holds the raw two-id port. That makes two things
 * worth proving here that could not be proved anywhere else: that the port is
 * only ever handed to the `ClientContext`-bound facade, and that one instance
 * routes two different `ClientContext`s to two different scopes.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ORCHESTRATOR_SOURCE = readFileSync(
  join(HERE, '..', 'scored-bif-snapshot-capture-orchestrator.ts'),
  'utf8',
);

const CONTEXT = sampleContext();

const ALPHA = new ClientContext('client-alpha', 'org-alpha');
/** Same organization, different client. */
const OTHER_CLIENT = new ClientContext('client-beta', 'org-alpha');
/** Same client, different organization. */
const OTHER_ORG = new ClientContext('client-alpha', 'org-beta');

const CAPTURE_INPUT = {
  clientContext: ALPHA,
  snapshotId: 'snap-1',
  capturedAt: '2026-07-15T09:30:00.000Z',
  context: CONTEXT,
} as const;

function orchestrator(port = new InMemoryScoredBifSnapshotRepository()): {
  port: InMemoryScoredBifSnapshotRepository;
  subject: ScoredBifSnapshotCaptureOrchestrator;
} {
  return { port, subject: new ScoredBifSnapshotCaptureOrchestrator(port) };
}

/** A port that fails every write, to exercise the failure branch. */
function failingPort(thrown: unknown): ScoredBifSnapshotRepository {
  return {
    async append() {
      throw thrown;
    },
    async findBySnapshotId() {
      return null;
    },
    async listSeries() {
      return [];
    },
    async findLatest() {
      return null;
    },
  } as unknown as ScoredBifSnapshotRepository;
}

describe('ScoredBifSnapshotCaptureOrchestrator', () => {
  describe('scope comes only from the supplied ClientContext', () => {
    it('writes both scope ids from the ClientContext passed on the call', async () => {
      const { port, subject } = orchestrator();

      await subject.capture(CAPTURE_INPUT);

      const stored = await port.findBySnapshotId({
        clientId: 'client-alpha',
        organizationId: 'org-alpha',
        bifId: CONTEXT.bifId,
        snapshotId: 'snap-1',
      });
      expect(stored?.clientId).toBe('client-alpha');
      expect(stored?.organizationId).toBe('org-alpha');
    });

    it('routes two different ClientContexts to two different scopes through ONE instance', async () => {
      const { port, subject } = orchestrator();

      // Identical inputs apart from the context — no rebinding, no second instance.
      await subject.capture({ ...CAPTURE_INPUT, clientContext: OTHER_CLIENT });
      await subject.capture({ ...CAPTURE_INPUT, clientContext: OTHER_ORG });

      expect(
        (
          await port.findBySnapshotId({
            clientId: 'client-beta',
            organizationId: 'org-alpha',
            bifId: CONTEXT.bifId,
            snapshotId: 'snap-1',
          })
        )?.clientId,
      ).toBe('client-beta');
      expect(
        (
          await port.findBySnapshotId({
            clientId: 'client-alpha',
            organizationId: 'org-beta',
            bifId: CONTEXT.bifId,
            snapshotId: 'snap-1',
          })
        )?.organizationId,
      ).toBe('org-beta');
      // And nothing landed in the scope neither call named.
      expect(
        await port.findBySnapshotId({
          clientId: 'client-alpha',
          organizationId: 'org-alpha',
          bifId: CONTEXT.bifId,
          snapshotId: 'snap-1',
        }),
      ).toBeNull();
    });

    it('holds no ambient scope between calls', () => {
      // Nothing is stashed on the instance but the port itself.
      const { subject } = orchestrator();
      expect(Object.values(subject)).toHaveLength(1);
      expect(ORCHESTRATOR_SOURCE).not.toMatch(/this\.(clientContext|context|scope)\b/);
    });
  });

  describe('callers cannot supply scope as ids', () => {
    it('rejects a clientId on the input at compile time', () => {
      // Assembled in a variable first, where excess-property checking would NOT
      // apply — `?: never` is what makes this fail anyway.
      // @ts-expect-error clientId is not a parameter — scope comes from ClientContext.
      const input: OrchestratorInput = { ...CAPTURE_INPUT, clientId: 'client-beta' };
      expect(input).toBeDefined();
    });

    it('rejects an organizationId on the input at compile time', () => {
      // @ts-expect-error organizationId is not a parameter — scope comes from ClientContext.
      const input: OrchestratorInput = { ...CAPTURE_INPUT, organizationId: 'org-beta' };
      expect(input).toBeDefined();
    });

    it('has no parameter named for either scope id', () => {
      expect(ORCHESTRATOR_SOURCE).not.toMatch(/^\s*readonly clientId: string/m);
      expect(ORCHESTRATOR_SOURCE).not.toMatch(/^\s*readonly organizationId: string/m);
    });
  });

  describe('the payload cannot influence scope', () => {
    it('ignores plausible scope ids planted in the context payload', async () => {
      const planted = {
        ...CONTEXT,
        metadata: { ...CONTEXT.metadata, clientId: 'client-beta', organizationId: 'org-beta' },
      } as unknown as ScoredBifContext;
      const { port, subject } = orchestrator();

      await subject.capture({ ...CAPTURE_INPUT, context: planted });

      expect(
        await port.findBySnapshotId({
          clientId: 'client-beta',
          organizationId: 'org-beta',
          bifId: CONTEXT.bifId,
          snapshotId: 'snap-1',
        }),
      ).toBeNull();
      const stored = await port.findBySnapshotId({
        clientId: 'client-alpha',
        organizationId: 'org-alpha',
        bifId: CONTEXT.bifId,
        snapshotId: 'snap-1',
      });
      expect(stored?.clientId).toBe('client-alpha');
      expect(stored?.organizationId).toBe('org-alpha');
    });

    it('never reads a scope id in its own source', () => {
      expect(ORCHESTRATOR_SOURCE).not.toMatch(/input\.(clientId|organizationId)/);
      expect(ORCHESTRATOR_SOURCE).not.toMatch(/context\.(clientId|organizationId)/);
      expect(ORCHESTRATOR_SOURCE).not.toMatch(/metadata\.(clientId|organizationId)/);
    });
  });

  describe('snapshotId and capturedAt are carried, never generated', () => {
    it('stores both verbatim and echoes them in the receipt', async () => {
      const { port, subject } = orchestrator();

      const outcome = await subject.capture({
        ...CAPTURE_INPUT,
        snapshotId: 'snap-caller-chosen',
        capturedAt: '2019-01-02T03:04:05.006Z',
      });

      expect(outcome).toEqual({
        status: 'captured',
        receipt: {
          bifId: CONTEXT.bifId,
          snapshotId: 'snap-caller-chosen',
          capturedAt: '2019-01-02T03:04:05.006Z',
        },
      });
      const latest = await port.findLatest({
        clientId: 'client-alpha',
        organizationId: 'org-alpha',
        bifId: CONTEXT.bifId,
      });
      expect(latest?.snapshotId).toBe('snap-caller-chosen');
      expect(latest?.capturedAt).toBe('2019-01-02T03:04:05.006Z');
    });

    it('generates no ids and reads no clock', () => {
      expect(ORCHESTRATOR_SOURCE).not.toMatch(/new Date\(/);
      expect(ORCHESTRATOR_SOURCE).not.toMatch(/Date\.now\(/);
      expect(ORCHESTRATOR_SOURCE).not.toMatch(/Math\.random\(/);
      expect(ORCHESTRATOR_SOURCE).not.toMatch(/performance\.now\(/);
      expect(ORCHESTRATOR_SOURCE).not.toMatch(/randomUUID|uuid|nanoid/i);
      expect(ORCHESTRATOR_SOURCE).not.toMatch(/process\.env/);
    });

    it('carries the receipt through unchanged, without the scope ids', async () => {
      const { subject } = orchestrator();

      const outcome = await subject.capture(CAPTURE_INPUT);

      expect(outcome.status).toBe('captured');
      if (outcome.status !== 'captured') return;
      expect(outcome.receipt).not.toHaveProperty('clientId');
      expect(outcome.receipt).not.toHaveProperty('organizationId');
    });
  });

  describe('it reaches the port only through the facade and the capture service', () => {
    it('hands the raw port to nothing but the bound facade constructor', () => {
      // The one thing the port is allowed to be used for.
      expect(ORCHESTRATOR_SOURCE).toMatch(
        /new ClientContextBoundScoredBifSnapshotRepository\(\s*input\.clientContext,\s*this\.snapshots,?\s*\)/,
      );
      // And no other use of it anywhere: exactly two mentions, the constructor
      // assignment and the facade construction above.
      const portUses = [...ORCHESTRATOR_SOURCE.matchAll(/this\.snapshots\b/g)];
      expect(portUses).toHaveLength(2);
      expect(ORCHESTRATOR_SOURCE).toMatch(/this\.snapshots = snapshots;/);
    });

    it('assembles no composite key and names no lower-level machinery', () => {
      expect(ORCHESTRATOR_SOURCE).not.toMatch(/PrismaScoredBifSnapshotRepository/);
      expect(ORCHESTRATOR_SOURCE).not.toMatch(/ScopedScoredBifSnapshotRepository/);
      expect(ORCHESTRATOR_SOURCE).not.toMatch(/ScoredBifSnapshotDelegate/);
      expect(ORCHESTRATOR_SOURCE).not.toMatch(/ScoredBifSnapshotScopeRunner/);
      expect(ORCHESTRATOR_SOURCE).not.toMatch(/toScoredBifSnapshotRow|fromScoredBifSnapshotRow/);
      expect(ORCHESTRATOR_SOURCE).not.toMatch(/scoredBifSnapshotSeriesKeyOf/);
    });

    it('does not read, and adds no serialization of its own', async () => {
      expect(ORCHESTRATOR_SOURCE).not.toMatch(/findBySnapshotId|findLatest|listSeries/);
      expect(ORCHESTRATOR_SOURCE).not.toMatch(/toScoredBifSnapshot\b|serializeScoredBifSnapshot/);
      expect(ORCHESTRATOR_SOURCE).not.toMatch(/JSON\.(stringify|parse)/);

      // Observable too: of the four port operations, a capture touches `append`
      // and none of the three reads. (Internal state the adapter reaches for on
      // itself is not a port operation and is deliberately not counted.)
      const touched: string[] = [];
      const spy = new Proxy(new InMemoryScoredBifSnapshotRepository(), {
        get(target, property, receiver) {
          if (typeof property === 'string') touched.push(property);
          return Reflect.get(target, property, receiver);
        },
      });
      await new ScoredBifSnapshotCaptureOrchestrator(spy).capture(CAPTURE_INPUT);
      const operations = ['append', 'findBySnapshotId', 'listSeries', 'findLatest'];
      expect(operations.filter((operation) => touched.includes(operation))).toEqual(['append']);
    });
  });

  describe('failure is reported, never thrown', () => {
    it('returns failed with the original Error when the adapter throws', async () => {
      const thrown = new Error('duplicate snapshot');
      const subject = new ScoredBifSnapshotCaptureOrchestrator(failingPort(thrown));

      const outcome = await subject.capture(CAPTURE_INPUT);

      expect(outcome.status).toBe('failed');
      if (outcome.status !== 'failed') return;
      expect(outcome.error).toBe(thrown);
    });

    it('reports a duplicate snapshotId as failed rather than propagating', async () => {
      const { subject } = orchestrator();

      const first = await subject.capture(CAPTURE_INPUT);
      const second = await subject.capture(CAPTURE_INPUT);

      expect(first.status).toBe('captured');
      expect(second.status).toBe('failed');
    });

    it('wraps a non-Error throw rather than discarding it', async () => {
      const subject = new ScoredBifSnapshotCaptureOrchestrator(failingPort('database unavailable'));

      const outcome = await subject.capture(CAPTURE_INPUT);

      expect(outcome.status).toBe('failed');
      if (outcome.status !== 'failed') return;
      expect(outcome.error).toBeInstanceOf(Error);
      expect(outcome.error.message).toContain('database unavailable');
    });

    it('classifies nothing — the outcome carries the error, not a category', () => {
      // ADR-0036 D8: the port defines no error taxonomy, so inferring one from
      // message text would be a fiction dressed as a contract.
      expect(ORCHESTRATOR_SOURCE).not.toMatch(/P2002/);
      expect(ORCHESTRATOR_SOURCE).not.toMatch(/isUniqueConstraintViolation/);
      expect(ORCHESTRATOR_SOURCE).not.toMatch(/error\.message\s*(\.|\?\.)?\s*(includes|match)/);
      expect(ORCHESTRATOR_SOURCE).not.toMatch(/'duplicate'|'conflict'|'unavailable'/);
    });
  });

  describe('what it does not do', () => {
    it('never touches a BIF status and never promotes', () => {
      const executable = ORCHESTRATOR_SOURCE.replace(/\/\*\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      expect(executable).not.toMatch(/\.status\s*=/);
      expect(executable).not.toMatch(/'Active'|"Active"/);
    });

    it('never imports @age/bif, Prisma, or anything outside the sanctioned set', () => {
      const specifiers = [...ORCHESTRATOR_SOURCE.matchAll(/from '([^']+)'/g)].map(
        (match) => match[1],
      );
      expect([...new Set(specifiers)].sort()).toEqual([
        './client-context-bound-scored-bif-snapshot-repository',
        './scored-bif-snapshot-capture',
        '@age/business-discovery-contracts',
        '@age/capability-kit',
      ]);
    });

    it('leaves the append-only shape alone — no update, delete or upsert', () => {
      expect(ORCHESTRATOR_SOURCE).not.toMatch(/\bupdate\b|\bdelete\b|\bupsert\b/);
    });

    it('produces nothing — it never maps, scores or projects', () => {
      // ADR-0036 D4/D6: the produce-side chain stays upstream and stays pure.
      // The doc comments name those functions to say they stay upstream; what
      // must be absent is any executable line calling them.
      const executable = ORCHESTRATOR_SOURCE.replace(/\/\*\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      expect(executable).not.toMatch(/mapBusinessDiscoveryToBifDraft/);
      expect(executable).not.toMatch(/scoreBusinessIntelligenceFramework/);
      expect(executable).not.toMatch(/projectScoredBifContext/);
      // Now that the chain has a single name (ADR-0037), that name is the one
      // most likely to be reached for here. It must stay just as absent.
      expect(executable).not.toMatch(/produceScoredBifContext/);
      expect(executable).not.toMatch(/BusinessIntelligenceFramework/);
    });
  });
});
