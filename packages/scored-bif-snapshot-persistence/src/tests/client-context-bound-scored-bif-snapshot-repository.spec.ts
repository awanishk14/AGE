import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  InMemoryScoredBifSnapshotRepository,
  type ScoredBifSnapshotRecord,
} from '@age/business-discovery-contracts';
import { ClientContext } from '@age/capability-kit';
import { describe, expect, it } from 'vitest';
import {
  ClientContextBoundScoredBifSnapshotRepository,
  type AppendScoredBifSnapshotInput as AppendInput,
  type ScoredBifSnapshotSeriesQuery as SeriesQuery,
} from '../client-context-bound-scored-bif-snapshot-repository';
import * as packageEntrypoint from '../index';
import { sampleContext } from './scored-bif-snapshot-repository-contract';

/**
 * ADR-0034: scope comes from `ClientContext` and from nowhere else.
 *
 * The suite runs against the in-memory adapter on purpose. What is under test
 * is which ids reach the port, and that is fully observable without a database
 * — the live RLS suite already proves what the database does with them once
 * they arrive. Using the real port implementation rather than a spy also means
 * these tests fail if the facade stops producing records the port accepts.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const FACADE_SOURCE = readFileSync(
  join(HERE, '..', 'client-context-bound-scored-bif-snapshot-repository.ts'),
  'utf8',
);

const CONTEXT = sampleContext();

const ALPHA = new ClientContext('client-alpha', 'org-alpha');
/** Same organization, different client — isolated only if `clientId` is enforced. */
const OTHER_CLIENT = new ClientContext('client-beta', 'org-alpha');
/** Same client, different organization. */
const OTHER_ORG = new ClientContext('client-alpha', 'org-beta');

function boundTo(context: ClientContext, port = new InMemoryScoredBifSnapshotRepository()) {
  return {
    port,
    repository: new ClientContextBoundScoredBifSnapshotRepository(context, port),
  };
}

const APPEND_INPUT = {
  snapshotId: 'snap-1',
  capturedAt: '2026-07-15T09:30:00.000Z',
  context: CONTEXT,
} as const;

describe('ClientContextBoundScoredBifSnapshotRepository', () => {
  describe('scope is taken from ClientContext', () => {
    it('writes the ClientContext ids onto the appended record', async () => {
      const { port, repository } = boundTo(ALPHA);

      await repository.append(APPEND_INPUT);

      const stored = await port.findBySnapshotId({
        clientId: 'client-alpha',
        organizationId: 'org-alpha',
        bifId: CONTEXT.bifId,
        snapshotId: 'snap-1',
      });

      expect(stored?.clientId).toBe('client-alpha');
      expect(stored?.organizationId).toBe('org-alpha');
    });

    it('uses the ClientContext ids on every read', async () => {
      const seen: Array<{ clientId: string; organizationId: string }> = [];
      const recording = {
        async append(record: ScoredBifSnapshotRecord) {
          seen.push({ clientId: record.clientId, organizationId: record.organizationId });
        },
        async findBySnapshotId(key: { clientId: string; organizationId: string }) {
          seen.push({ clientId: key.clientId, organizationId: key.organizationId });
          return null;
        },
        async listSeries(key: { clientId: string; organizationId: string }) {
          seen.push({ clientId: key.clientId, organizationId: key.organizationId });
          return [];
        },
        async findLatest(key: { clientId: string; organizationId: string }) {
          seen.push({ clientId: key.clientId, organizationId: key.organizationId });
          return null;
        },
      };

      const repository = new ClientContextBoundScoredBifSnapshotRepository(ALPHA, recording);

      await repository.append(APPEND_INPUT);
      await repository.findBySnapshotId({ bifId: CONTEXT.bifId, snapshotId: 'snap-1' });
      await repository.listSeries({ bifId: CONTEXT.bifId });
      await repository.findLatest({ bifId: CONTEXT.bifId });

      expect(seen).toHaveLength(4);
      for (const scope of seen) {
        expect(scope).toEqual({ clientId: 'client-alpha', organizationId: 'org-alpha' });
      }
    });

    it('follows the ClientContext it was constructed with, not a shared default', async () => {
      const port = new InMemoryScoredBifSnapshotRepository();
      const alpha = new ClientContextBoundScoredBifSnapshotRepository(ALPHA, port);
      const beta = new ClientContextBoundScoredBifSnapshotRepository(OTHER_CLIENT, port);

      await alpha.append(APPEND_INPUT);
      await beta.append(APPEND_INPUT);

      // Same bifId, same snapshotId, two scopes: two distinct rows, neither
      // colliding with the other. The id is only unique WITHIN a scope.
      expect(await alpha.findLatest({ bifId: CONTEXT.bifId })).not.toBeNull();
      expect(await beta.findLatest({ bifId: CONTEXT.bifId })).not.toBeNull();
      expect((await alpha.findLatest({ bifId: CONTEXT.bifId }))?.clientId).toBe('client-alpha');
      expect((await beta.findLatest({ bifId: CONTEXT.bifId }))?.clientId).toBe('client-beta');
    });
  });

  describe('scope cannot come from the payload', () => {
    it('ignores client-looking ids planted in the context payload', async () => {
      // The context is JSON; nothing stops a caller putting these in it. What
      // matters is that the facade never looks (ADR-0034 D8).
      const planted = {
        ...CONTEXT,
        clientId: 'client-attacker',
        organizationId: 'org-attacker',
      } as unknown as typeof CONTEXT;

      const { port, repository } = boundTo(ALPHA);
      await repository.append({ ...APPEND_INPUT, context: planted });

      const stored = await port.findLatest({
        clientId: 'client-alpha',
        organizationId: 'org-alpha',
        bifId: CONTEXT.bifId,
      });

      expect(stored?.clientId).toBe('client-alpha');
      expect(stored?.organizationId).toBe('org-alpha');

      // And the planted scope addresses nothing at all.
      expect(
        await port.findLatest({
          clientId: 'client-attacker',
          organizationId: 'org-attacker',
          bifId: CONTEXT.bifId,
        }),
      ).toBeNull();
    });

    it('never reads a scope id out of the payload in its source', () => {
      // The only place either id may be produced is from `this.context`.
      const scopeReads = FACADE_SOURCE.match(/\.clientId|\.organizationId/g) ?? [];
      const fromContext = FACADE_SOURCE.match(/this\.context\.(clientId|organizationId)/g) ?? [];

      expect(scopeReads).toHaveLength(fromContext.length);
      expect(FACADE_SOURCE).not.toMatch(/input\.(clientId|organizationId)/);
      expect(FACADE_SOURCE).not.toMatch(/context\.metadata\.(clientId|organizationId)/);
    });
  });

  describe('callers cannot supply scope', () => {
    it('rejects a clientId on the append input at compile time', () => {
      // @ts-expect-error clientId is not a parameter — scope comes from ClientContext.
      const input: AppendInput = { ...APPEND_INPUT, clientId: 'client-beta' };
      expect(input).toBeDefined();
    });

    it('rejects an organizationId on the append input at compile time', () => {
      // @ts-expect-error organizationId is not a parameter — scope comes from ClientContext.
      const input: AppendInput = { ...APPEND_INPUT, organizationId: 'org-beta' };
      expect(input).toBeDefined();
    });

    it('rejects a clientId on a read query at compile time', () => {
      // @ts-expect-error clientId is not a parameter — scope comes from ClientContext.
      const query: SeriesQuery = { bifId: CONTEXT.bifId, clientId: 'client-beta' };
      expect(query).toBeDefined();
    });

    it('rejects an organizationId on a read query at compile time', () => {
      // @ts-expect-error organizationId is not a parameter — scope comes from ClientContext.
      const query: SeriesQuery = { bifId: CONTEXT.bifId, organizationId: 'org-beta' };
      expect(query).toBeDefined();
    });

    it('declares neither scope id as a usable input field', () => {
      // The `?: never` members exist so the errors above fire even when the
      // input is assembled in a variable, where excess-property checking does
      // not apply. If they were ever given real types, these tests would still
      // compile — so assert the declaration itself.
      expect(FACADE_SOURCE).toMatch(/readonly clientId\?: never;/);
      expect(FACADE_SOURCE).toMatch(/readonly organizationId\?: never;/);
    });
  });

  describe('wrong scope, expressed as a different ClientContext', () => {
    it('cannot read another client’s snapshot in the same organization', async () => {
      const port = new InMemoryScoredBifSnapshotRepository();
      await new ClientContextBoundScoredBifSnapshotRepository(ALPHA, port).append(APPEND_INPUT);

      const other = new ClientContextBoundScoredBifSnapshotRepository(OTHER_CLIENT, port);

      expect(
        await other.findBySnapshotId({ bifId: CONTEXT.bifId, snapshotId: 'snap-1' }),
      ).toBeNull();
      expect(await other.listSeries({ bifId: CONTEXT.bifId })).toEqual([]);
      expect(await other.findLatest({ bifId: CONTEXT.bifId })).toBeNull();
    });

    it('cannot read another organization’s snapshot for the same client', async () => {
      const port = new InMemoryScoredBifSnapshotRepository();
      await new ClientContextBoundScoredBifSnapshotRepository(ALPHA, port).append(APPEND_INPUT);

      const other = new ClientContextBoundScoredBifSnapshotRepository(OTHER_ORG, port);

      expect(
        await other.findBySnapshotId({ bifId: CONTEXT.bifId, snapshotId: 'snap-1' }),
      ).toBeNull();
      expect(await other.listSeries({ bifId: CONTEXT.bifId })).toEqual([]);
      expect(await other.findLatest({ bifId: CONTEXT.bifId })).toBeNull();
    });

    it('is the only way a foreign scope can be named: there is no other parameter', () => {
      // The point of D7. A wrong-scope test here has to construct a second
      // ClientContext, because payload mutation and hand-built foreign keys are
      // not expressible through this surface.
      expect(FACADE_SOURCE).not.toMatch(/clientId:\s*(input|query)\./);
      expect(FACADE_SOURCE).not.toMatch(/organizationId:\s*(input|query)\./);
    });
  });

  describe('what it does not do', () => {
    it('declares no update, delete or upsert', () => {
      expect(FACADE_SOURCE).not.toMatch(/\b(update|delete|upsert|softDelete)\s*\(/);
    });

    it('reads no clock, mints no id, and uses no randomness', () => {
      expect(FACADE_SOURCE).not.toMatch(/new Date\(|Date\.now\(|Math\.random\(|randomUUID/);
    });

    it('never writes a BIF status', () => {
      // Only the doc comment may mention promotion — to say it does not happen.
      expect(FACADE_SOURCE).not.toMatch(/status/);
      expect(FACADE_SOURCE).not.toMatch(/'Active'|"Active"/);
    });

    it('is exported from the package entry point', () => {
      expect(packageEntrypoint.ClientContextBoundScoredBifSnapshotRepository).toBe(
        ClientContextBoundScoredBifSnapshotRepository,
      );
    });
  });

  describe('the lower-level port still works underneath', () => {
    it('produces records the unchanged port accepts and can read back directly', async () => {
      const { port, repository } = boundTo(ALPHA);

      await repository.append(APPEND_INPUT);
      await repository.append({
        ...APPEND_INPUT,
        snapshotId: 'snap-2',
        capturedAt: '2026-07-16T09:30:00.000Z',
      });

      // Read through the composite-key port itself — it is unchanged and still
      // supported (ADR-0034 D4).
      const series = await port.listSeries({
        clientId: 'client-alpha',
        organizationId: 'org-alpha',
        bifId: CONTEXT.bifId,
      });

      expect(series).toHaveLength(2);
      expect(series.map((record) => record.snapshotId)).toEqual(['snap-1', 'snap-2']);
    });

    it('still rejects a duplicate snapshot id within the scope', async () => {
      const { repository } = boundTo(ALPHA);

      await repository.append(APPEND_INPUT);

      await expect(repository.append(APPEND_INPUT)).rejects.toThrow();
    });

    it('orders findLatest by capture time, not by insertion order', async () => {
      const { repository } = boundTo(ALPHA);

      await repository.append({
        ...APPEND_INPUT,
        snapshotId: 'later',
        capturedAt: '2026-07-20T09:30:00.000Z',
      });
      await repository.append({
        ...APPEND_INPUT,
        snapshotId: 'earlier',
        capturedAt: '2026-07-01T09:30:00.000Z',
      });

      expect((await repository.findLatest({ bifId: CONTEXT.bifId }))?.snapshotId).toBe('later');
    });
  });
});
