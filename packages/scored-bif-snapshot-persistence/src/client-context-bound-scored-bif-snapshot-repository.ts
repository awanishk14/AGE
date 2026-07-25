import type {
  ScoredBifContext,
  ScoredBifSnapshotRecord,
  ScoredBifSnapshotRepository,
} from '@age/business-discovery-contracts';
import { toScoredBifSnapshot } from '@age/business-discovery-contracts';
import type { ClientContext } from '@age/capability-kit';

/**
 * The `ClientContext`-bound entry point to scored BIF snapshot persistence
 * (ADR-0034).
 *
 * WHAT THIS EXISTS TO CLOSE. PR #114 put row-level security on the table and
 * proved it against live PostgreSQL. The policy is right, but
 * `ScopedScoredBifSnapshotRepository` derives its transaction-local settings
 * FROM THE KEY IT IS HANDED, so scope and key cannot disagree by construction:
 * a caller that hands it a `client-b` key opens a `client-b` transaction and
 * the policy correctly admits `client-b` rows. The database checks that the
 * declared scope and the row agree. Nothing below this file checks that the
 * declared scope is the caller's OWN.
 *
 * That is what this type is for, and it does it with the type system rather
 * than a runtime check: there is no parameter through which a caller can offer
 * a `clientId` or an `organizationId`. Both are read off the `ClientContext`
 * this instance was constructed with (ADR-0009, ADR-0034 D1/D2). A caller
 * scoped to one client cannot express an operation against another — not
 * "will be rejected", but "does not compile".
 *
 * IT WRAPS, IT DOES NOT REPLACE. The port keeps its structural two-id shape and
 * every existing adapter still satisfies it unchanged (ADR-0034 D4). Composite
 * keys remain how rows are addressed; this governs how they are CONSTRUCTED.
 * Passing a `ScopedScoredBifSnapshotRepository` gives the full chain the
 * accepted ADR describes: `ClientContext` → key → transaction-local settings →
 * policy re-check against the row (D6).
 *
 * IT IS INERT. No clock, no randomness, no id generation. `snapshotId` and
 * `capturedAt` stay caller-supplied exactly as ADR-0030 decided.
 */

/**
 * Fields a caller may supply when appending. Scope is deliberately absent.
 *
 * The two `?: never` members are not decoration. Excess-property checking only
 * catches an object literal; a caller assembling input in a variable first
 * would otherwise slip a `clientId` through unnoticed, where it would be
 * silently ignored — and silently ignored is the failure mode this ADR exists
 * to remove. Declaring them as `never` makes any attempt to populate them a
 * compile error at the point it is written.
 */
export interface AppendScoredBifSnapshotInput {
  /**
   * Identity of this member of the series. Caller-supplied on purpose
   * (ADR-0030 D4): this layer mints no ids.
   */
  readonly snapshotId: string;
  /**
   * Canonical ISO-8601 UTC capture instant. Caller-supplied for the same
   * reason, so nothing here reads a clock.
   */
  readonly capturedAt: string;
  /**
   * The projected scored BIF context. It carries `bifId` — the SUBJECT of the
   * snapshot, which is a legitimate caller input (ADR-0034 D8) — and its
   * `metadata.scoringVersion`, which the row projection reads directly.
   *
   * Taking `bifId` from here rather than as a second parameter follows the same
   * reasoning the accepted ADR applied to `scoringVersion`: a value the payload
   * already carries must not get a second, contradictable source. It is still
   * caller-supplied; it simply arrives in the field it already occupies.
   *
   * It carries NO client or organization id, and must never grow one.
   */
  readonly context: ScoredBifContext;

  /** @deprecated Not a parameter. Scope comes from `ClientContext` (ADR-0034 D2). */
  readonly clientId?: never;
  /** @deprecated Not a parameter. Scope comes from `ClientContext` (ADR-0034 D2). */
  readonly organizationId?: never;
}

/** Names one series: the snapshots taken of one BIF, within the bound scope. */
export interface ScoredBifSnapshotSeriesQuery {
  readonly bifId: string;

  /** @deprecated Not a parameter. Scope comes from `ClientContext` (ADR-0034 D2). */
  readonly clientId?: never;
  /** @deprecated Not a parameter. Scope comes from `ClientContext` (ADR-0034 D2). */
  readonly organizationId?: never;
}

/** Names exactly one snapshot within the bound scope. */
export interface ScoredBifSnapshotQuery extends ScoredBifSnapshotSeriesQuery {
  readonly snapshotId: string;
}

export class ClientContextBoundScoredBifSnapshotRepository {
  private readonly context: ClientContext;
  private readonly repository: ScoredBifSnapshotRepository;

  constructor(context: ClientContext, repository: ScoredBifSnapshotRepository) {
    this.context = context;
    this.repository = repository;
  }

  /**
   * Appends one immutable snapshot inside the bound scope.
   *
   * The record's `clientId` and `organizationId` are written from the
   * `ClientContext` and from nothing else — not from `input`, which cannot
   * carry them, and not from `input.context`, which is never consulted for
   * scope (ADR-0034 D8).
   */
  async append(input: AppendScoredBifSnapshotInput): Promise<void> {
    return this.repository.append({
      ...this.scope(),
      bifId: input.context.bifId,
      snapshotId: input.snapshotId,
      capturedAt: input.capturedAt,
      snapshot: toScoredBifSnapshot(input.context),
    });
  }

  /** One snapshot by subject and member, or `null` when the bound scope holds no such row. */
  async findBySnapshotId(query: ScoredBifSnapshotQuery): Promise<ScoredBifSnapshotRecord | null> {
    return this.repository.findBySnapshotId({
      ...this.scope(),
      bifId: query.bifId,
      snapshotId: query.snapshotId,
    });
  }

  /** The whole series within the bound scope, oldest first. */
  async listSeries(
    query: ScoredBifSnapshotSeriesQuery,
  ): Promise<ReadonlyArray<ScoredBifSnapshotRecord>> {
    return this.repository.listSeries({ ...this.scope(), bifId: query.bifId });
  }

  /**
   * The most recently captured member of the series within the bound scope.
   *
   * Still a query over an append-only series, never a mutable pointer, and it
   * says nothing about whether the BIF may be promoted from `Draft` to
   * `Active` — which stays undecided and out of scope.
   */
  async findLatest(query: ScoredBifSnapshotSeriesQuery): Promise<ScoredBifSnapshotRecord | null> {
    return this.repository.findLatest({ ...this.scope(), bifId: query.bifId });
  }

  /**
   * The single place scope is produced. Reading both ids from one object, in
   * one method, is what makes "scope comes from `ClientContext`" checkable by
   * reading rather than by trusting four call sites.
   */
  private scope(): { readonly clientId: string; readonly organizationId: string } {
    return {
      clientId: this.context.clientId,
      organizationId: this.context.organizationId,
    };
  }
}
