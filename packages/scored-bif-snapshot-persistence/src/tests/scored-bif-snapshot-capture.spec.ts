import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  InMemoryScoredBifSnapshotRepository,
  type ScoredBifContext,
} from '@age/business-discovery-contracts';
import { ClientContext } from '@age/capability-kit';
import { describe, expect, it } from 'vitest';
import { ClientContextBoundScoredBifSnapshotRepository } from '../client-context-bound-scored-bif-snapshot-repository';
import {
  ScoredBifSnapshotCapture,
  type CaptureScoredBifSnapshotInput as CaptureInput,
} from '../scored-bif-snapshot-capture';
import { sampleContext } from './scored-bif-snapshot-repository-contract';

/**
 * ADR-0035: the capture service is the first real caller of `ClientContext`-bound
 * access, and it must not become a second way for scope to enter the system.
 *
 * The suite runs against the real facade over the real in-memory port. What is
 * under test is which ids reach storage and by what path, and that is fully
 * observable without a database — the live RLS suite already proves what the
 * database does with them once they arrive.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const CAPTURE_SOURCE = readFileSync(join(HERE, '..', 'scored-bif-snapshot-capture.ts'), 'utf8');

const CONTEXT = sampleContext();

const ALPHA = new ClientContext('client-alpha', 'org-alpha');
/** Same organization, different client. */
const OTHER_CLIENT = new ClientContext('client-beta', 'org-alpha');
/** Same client, different organization. */
const OTHER_ORG = new ClientContext('client-alpha', 'org-beta');

const CAPTURE_INPUT = {
  snapshotId: 'snap-1',
  capturedAt: '2026-07-15T09:30:00.000Z',
  context: CONTEXT,
} as const;

function captureBoundTo(
  context: ClientContext,
  port = new InMemoryScoredBifSnapshotRepository(),
): { port: InMemoryScoredBifSnapshotRepository; capture: ScoredBifSnapshotCapture } {
  return {
    port,
    capture: new ScoredBifSnapshotCapture(
      new ClientContextBoundScoredBifSnapshotRepository(context, port),
    ),
  };
}

describe('ScoredBifSnapshotCapture', () => {
  describe('scope comes only from ClientContext', () => {
    it('writes the ClientContext clientId onto the captured record', async () => {
      const { port, capture } = captureBoundTo(ALPHA);

      await capture.capture(CAPTURE_INPUT);

      const stored = await port.findBySnapshotId({
        clientId: 'client-alpha',
        organizationId: 'org-alpha',
        bifId: CONTEXT.bifId,
        snapshotId: 'snap-1',
      });

      expect(stored?.clientId).toBe('client-alpha');
    });

    it('writes the ClientContext organizationId onto the captured record', async () => {
      const { port, capture } = captureBoundTo(ALPHA);

      await capture.capture(CAPTURE_INPUT);

      const stored = await port.findBySnapshotId({
        clientId: 'client-alpha',
        organizationId: 'org-alpha',
        bifId: CONTEXT.bifId,
        snapshotId: 'snap-1',
      });

      expect(stored?.organizationId).toBe('org-alpha');
    });

    it('captures into a different client when bound to a different ClientContext', async () => {
      const { port, capture } = captureBoundTo(OTHER_CLIENT);

      await capture.capture(CAPTURE_INPUT);

      // Same inputs, different binding — and the row lands in the other client.
      expect(
        await port.findBySnapshotId({
          clientId: 'client-alpha',
          organizationId: 'org-alpha',
          bifId: CONTEXT.bifId,
          snapshotId: 'snap-1',
        }),
      ).toBeNull();
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
    });

    it('captures into a different organization when bound to a different ClientContext', async () => {
      const { port, capture } = captureBoundTo(OTHER_ORG);

      await capture.capture(CAPTURE_INPUT);

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
    });
  });

  describe('callers cannot supply scope', () => {
    it('rejects a clientId on the capture input at compile time', () => {
      // Assembled in a variable first, where excess-property checking would NOT
      // apply — `?: never` is what makes this fail anyway.
      // @ts-expect-error clientId is not a parameter — scope comes from ClientContext.
      const input: CaptureInput = { ...CAPTURE_INPUT, clientId: 'client-beta' };
      expect(input).toBeDefined();
    });

    it('rejects an organizationId on the capture input at compile time', () => {
      // @ts-expect-error organizationId is not a parameter — scope comes from ClientContext.
      const input: CaptureInput = { ...CAPTURE_INPUT, organizationId: 'org-beta' };
      expect(input).toBeDefined();
    });

    it('has no capture parameter named for either scope id', () => {
      expect(CAPTURE_SOURCE).not.toMatch(/^\s*readonly clientId: string/m);
      expect(CAPTURE_SOURCE).not.toMatch(/^\s*readonly organizationId: string/m);
    });
  });

  describe('the payload cannot influence scope', () => {
    it('ignores plausible scope ids planted in the context payload', async () => {
      const planted = {
        ...CONTEXT,
        metadata: { ...CONTEXT.metadata, clientId: 'client-beta', organizationId: 'org-beta' },
      } as unknown as ScoredBifContext;
      const { port, capture } = captureBoundTo(ALPHA);

      await capture.capture({ ...CAPTURE_INPUT, context: planted });

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

    it('never names a scope id in its own source', () => {
      // Not from the input, not from the context, not from metadata, not at all.
      // The doc comments say the words; no executable line reads them.
      expect(CAPTURE_SOURCE).not.toMatch(/input\.(clientId|organizationId)/);
      expect(CAPTURE_SOURCE).not.toMatch(/context\.(clientId|organizationId)/);
      expect(CAPTURE_SOURCE).not.toMatch(/metadata\.(clientId|organizationId)/);
    });
  });

  describe('snapshotId and capturedAt are carried, never generated', () => {
    it('stores the caller-supplied snapshotId verbatim', async () => {
      const { port, capture } = captureBoundTo(ALPHA);

      await capture.capture({ ...CAPTURE_INPUT, snapshotId: 'snap-caller-chosen' });

      const series = await port.listSeries({
        clientId: 'client-alpha',
        organizationId: 'org-alpha',
        bifId: CONTEXT.bifId,
      });
      expect(series.map((record) => record.snapshotId)).toEqual(['snap-caller-chosen']);
    });

    it('stores the caller-supplied capturedAt verbatim', async () => {
      const { port, capture } = captureBoundTo(ALPHA);

      await capture.capture({ ...CAPTURE_INPUT, capturedAt: '2019-01-02T03:04:05.006Z' });

      const latest = await port.findLatest({
        clientId: 'client-alpha',
        organizationId: 'org-alpha',
        bifId: CONTEXT.bifId,
      });
      expect(latest?.capturedAt).toBe('2019-01-02T03:04:05.006Z');
    });

    it('generates no ids and reads no clock', () => {
      expect(CAPTURE_SOURCE).not.toMatch(/new Date\(/);
      expect(CAPTURE_SOURCE).not.toMatch(/Date\.now\(/);
      expect(CAPTURE_SOURCE).not.toMatch(/Math\.random\(/);
      expect(CAPTURE_SOURCE).not.toMatch(/performance\.now\(/);
      expect(CAPTURE_SOURCE).not.toMatch(/randomUUID|uuid|nanoid/i);
      expect(CAPTURE_SOURCE).not.toMatch(/process\.env/);
    });

    it('returns a receipt assembled from what was written, without the scope ids', async () => {
      const { capture } = captureBoundTo(ALPHA);

      const receipt = await capture.capture(CAPTURE_INPUT);

      expect(receipt).toEqual({
        bifId: CONTEXT.bifId,
        snapshotId: 'snap-1',
        capturedAt: '2026-07-15T09:30:00.000Z',
      });
      expect(receipt).not.toHaveProperty('clientId');
      expect(receipt).not.toHaveProperty('organizationId');
    });
  });

  describe('it reaches storage only through the ClientContext-bound facade', () => {
    it('delegates to the facade, which is the only collaborator it takes', async () => {
      const appended: Array<{ snapshotId: string; capturedAt: string; bifId: string }> = [];
      const facade = {
        async append(input: { snapshotId: string; capturedAt: string; context: ScoredBifContext }) {
          appended.push({
            snapshotId: input.snapshotId,
            capturedAt: input.capturedAt,
            bifId: input.context.bifId,
          });
        },
      } as unknown as ClientContextBoundScoredBifSnapshotRepository;

      await new ScoredBifSnapshotCapture(facade).capture(CAPTURE_INPUT);

      expect(appended).toEqual([
        { snapshotId: 'snap-1', capturedAt: '2026-07-15T09:30:00.000Z', bifId: CONTEXT.bifId },
      ]);
    });

    it('never names a lower-level repository, delegate or composite key', () => {
      expect(CAPTURE_SOURCE).not.toMatch(/PrismaScoredBifSnapshotRepository/);
      expect(CAPTURE_SOURCE).not.toMatch(/ScopedScoredBifSnapshotRepository/);
      expect(CAPTURE_SOURCE).not.toMatch(/ScoredBifSnapshotDelegate/);
      expect(CAPTURE_SOURCE).not.toMatch(/ScoredBifSnapshotScopeRunner/);
      expect(CAPTURE_SOURCE).not.toMatch(/toScoredBifSnapshotRow|fromScoredBifSnapshotRow/);
      // Not the raw port either: the two-id shape is exactly what it must not touch.
      expect(CAPTURE_SOURCE).not.toMatch(/\bScoredBifSnapshotRepository\b/);
    });

    it('adds no serialization of its own', () => {
      // The facade already applies `toScoredBifSnapshot`. A second envelope
      // would mean two shapes claiming to be the snapshot format (ADR-0035 D7).
      expect(CAPTURE_SOURCE).not.toMatch(/toScoredBifSnapshot\b/);
      expect(CAPTURE_SOURCE).not.toMatch(/serializeScoredBifSnapshot/);
      expect(CAPTURE_SOURCE).not.toMatch(/JSON\.(stringify|parse)/);
    });

    it('does not read', () => {
      expect(CAPTURE_SOURCE).not.toMatch(/findBySnapshotId|findLatest|listSeries/);
    });
  });

  describe('what it does not do', () => {
    it('never touches a BIF status and never promotes', () => {
      expect(CAPTURE_SOURCE).not.toMatch(/status/);
      expect(CAPTURE_SOURCE).not.toMatch(/'Active'|"Active"/);
    });

    it('never imports @age/bif, Prisma, or anything outside the two sanctioned packages', () => {
      const specifiers = [...CAPTURE_SOURCE.matchAll(/from '([^']+)'/g)].map((match) => match[1]);
      expect(specifiers.sort()).toEqual([
        './client-context-bound-scored-bif-snapshot-repository',
        '@age/business-discovery-contracts',
      ]);
    });

    it('leaves the append-only shape alone — no update, delete or upsert', () => {
      expect(CAPTURE_SOURCE).not.toMatch(/\bupdate\b|\bdelete\b|\bupsert\b/);
    });
  });
});
