import type { UniqueId } from '@age/shared';

/** A monotonically increasing aggregate version (1, 2, … N). */
export type VersionNumber = number;

/**
 * AggregateVersion — a single historical version of an aggregate.
 * Placeholder architecture for version history and future event sourcing.
 */
export interface AggregateVersion {
  readonly aggregateId: UniqueId;
  readonly version: VersionNumber;
  readonly recordedAt: Date;
  readonly snapshot: Readonly<Record<string, unknown>>;
}

/** Marks a record as carrying an optimistic-concurrency version. */
export interface Versioned {
  readonly version: VersionNumber;
}
