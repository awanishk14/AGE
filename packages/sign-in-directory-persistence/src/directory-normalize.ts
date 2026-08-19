import type { DirectoryAccount, DirectoryEntry, DirectoryMembership } from '@age/sign-in-directory';

import type { DirectoryDelegates } from './directory-scope-runner';

/**
 * **ONE normalizer, for BOTH doors** — the tenant-scoped read and ADR-0080's
 * fenced platform read.
 *
 * 🛑 **IT LIVES HERE PRECISELY BECAUSE ADR-0080 §3 PREDICTED THE FAILURE.** Its
 * warning about Option A is that a second path to the same tables is the one
 * that rots. The rot is 🚫 not the transaction boundary — those two MUST differ,
 * and differ visibly. It is the row handling: two copies of "a membership
 * missing its `scope_kind` is DROPPED, never coerced" are two chances to
 * disagree, and 🛑 the copy that gets relaxed still passes its own tests.
 *
 * ⚠️ **ROWS ARE UNTRUSTED INPUT AND ARE RE-VALIDATED HERE** (ADR-0031's rule).
 * A row whose shape does not match is DROPPED rather than coerced: a membership
 * missing its `scope_kind` is 🚫 not an agency membership with a blank kind, and
 * defaulting one would be this module authoring a grant.
 *
 * 🚫 **NO EMAIL NORMALIZATION OF ITS OWN.** The address arrives already lowered
 * by `verifiedGoogleIdentity`, which is the ONE place that decision is taken.
 *
 * 🚫 **IT DECIDES NOTHING** and 🚫 opens no transaction: it is handed delegates
 * that are already bound to one, by whichever runner bound them.
 */

/**
 * ⚠️ **ONE BODY FOR BOTH DOORS.** The normalization, the drop-a-malformed-row
 * rule and the no-account short circuit are the same facts however the account
 * was named, and two copies of them would be two chances to disagree.
 */
export async function normalizeDirectoryEntry(
  delegates: DirectoryDelegates,
  where: { readonly email: string } | { readonly accountId: string },
): Promise<DirectoryEntry> {
  const accountRow: unknown = await delegates.accounts.findUnique({ where });
  const account = normalizeAccount(accountRow);

  // ⚠️ No account means no memberships to ask about, and asking anyway would
  // be a membership read with no account id to give it.
  if (account === undefined) {
    return Object.freeze({ account: undefined, memberships: Object.freeze([]) });
  }

  const membershipRows = await delegates.memberships.findMany({
    where: { accountId: account.accountId },
  });

  return Object.freeze({
    account,
    memberships: Object.freeze(
      membershipRows
        .map(normalizeMembership)
        .filter((membership): membership is DirectoryMembership => membership !== undefined),
    ),
  });
}

function normalizeAccount(row: unknown): DirectoryAccount | undefined {
  const record = asRecord(row);
  if (record === undefined) return undefined;

  const accountId = requiredString(record['accountId']);
  const email = requiredString(record['email']);

  if (accountId === undefined || email === undefined) return undefined;

  return Object.freeze({ accountId, email, disabledAt: nullableString(record['disabledAt']) });
}

function normalizeMembership(row: unknown): DirectoryMembership | undefined {
  const record = asRecord(row);
  if (record === undefined) return undefined;

  const membershipId = requiredString(record['membershipId']);
  const accountId = requiredString(record['accountId']);
  const scopeKind = requiredString(record['scopeKind']);
  const roleBundle = requiredString(record['roleBundle']);

  if (
    membershipId === undefined ||
    accountId === undefined ||
    scopeKind === undefined ||
    roleBundle === undefined
  ) {
    return undefined;
  }

  return Object.freeze({
    membershipId,
    accountId,
    scopeKind,
    organizationId: nullableString(record['organizationId']),
    clientId: nullableString(record['clientId']),
    roleBundle,
    revokedAt: nullableString(record['revokedAt']),
  });
}

function asRecord(row: unknown): Record<string, unknown> | undefined {
  if (typeof row !== 'object' || row === null || Array.isArray(row)) return undefined;
  return row as Record<string, unknown>;
}

function requiredString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/**
 * ⚠️ **ANYTHING THAT IS NOT A NON-EMPTY STRING READS AS `null`, AND FOR
 * `revokedAt` THAT IS THE SAFE DIRECTION ONLY BECAUSE OF WHAT `null` MEANS
 * HERE.** `null` is "not revoked", so a malformed instant would read as LIVE.
 * That is why a membership missing any REQUIRED field is dropped whole above,
 * and why `revoked_at` is `TIMESTAMPTZ`-shaped text the database itself
 * constrains — a garbage value cannot be stored, so it cannot be read.
 */
function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}
