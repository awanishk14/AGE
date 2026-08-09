import type { AuthenticatedOrganizationId } from '@age/entitlement';

import type { AuditEntry, AuditEvent } from './audit-entry';
import { AuditEntryRefusedError } from './audit-entry';

/**
 * The "retrievable" half of ADR-0061 **A6 item 6**.
 *
 * ⚠️ **AN AUDIT READ IS A READ, AND A6 ITEM 5 APPLIES TO IT.** The trail is not
 * a place where tenants are mixed for convenience: a question asked within a
 * session sees that session's organization and nothing else.
 *
 * 🛑 **AN ENTRY WITH NO ORGANIZATION IS DELIBERATELY UNREACHABLE HERE.** A failed
 * sign-in for a subject nobody recognizes belongs to no tenant — returning it to
 * a tenant would be handing them evidence about someone else, and attributing it
 * to the asking tenant would be inventing an attribution. Those entries are the
 * operator's, and 🚫 a surface for them needs its own ADR rather than a quiet
 * `?? organizationId` here.
 *
 * Pure: the entries and the window arrive as parameters. 🚫 No store, no clock.
 */

export interface AuditQuery {
  /**
   * The organization the session speaks for.
   *
   * ⚠️ Typed as a branded authenticated id so a request parameter cannot reach
   * it — the same rule the rows themselves are read under.
   */
  readonly organizationId: AuthenticatedOrganizationId;
  /** Inclusive lower bound, ISO-8601 UTC. */
  readonly from: string;
  /** Exclusive upper bound, ISO-8601 UTC. */
  readonly until: string;
  /** ⚠️ Optional narrowing. 🚫 Absent means every event, never "the interesting ones". */
  readonly event?: AuditEvent;
}

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * The entries this session may see, oldest first.
 *
 * ⚠️ Ordered explicitly rather than "as stored": a trail whose order depends on
 * the store's insertion order cannot answer "what happened next".
 *
 * @throws {AuditEntryRefusedError} if the window is not two canonical instants
 *         in order, or the query names no organization.
 */
export function selectTenantAuditEntries(
  entries: readonly AuditEntry[],
  query: AuditQuery,
): readonly AuditEntry[] {
  if (query.organizationId.trim() === '') {
    throw new AuditEntryRefusedError(
      'An audit question needs the organization it is asked within. A blank one is not "the ' +
        'whole trail" — there is no such question here.',
    );
  }

  if (!INSTANT.test(query.from) || !INSTANT.test(query.until)) {
    throw new AuditEntryRefusedError(
      'An audit window is two canonical ISO-8601 UTC instants. A window nobody can state ' +
        'exactly is a window nobody can reproduce.',
    );
  }

  if (query.from >= query.until) {
    throw new AuditEntryRefusedError(
      'An audit window ends after it begins. An inverted or empty window silently answers ' +
        '"nothing happened", which is the wrong shape of answer to a security question.',
    );
  }

  return entries
    .filter((entry) => entry.actor.organizationId === query.organizationId)
    .filter((entry) => entry.occurredAt >= query.from && entry.occurredAt < query.until)
    .filter((entry) => query.event === undefined || entry.event === query.event)
    .slice()
    .sort((left, right) =>
      left.occurredAt === right.occurredAt
        ? left.entryId.localeCompare(right.entryId)
        : left.occurredAt.localeCompare(right.occurredAt),
    );
}
