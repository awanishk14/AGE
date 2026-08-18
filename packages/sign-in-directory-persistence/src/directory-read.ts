import type { DirectoryAccount, DirectoryEntry, DirectoryMembership } from '@age/sign-in-directory';

import type { DirectoryScope, DirectoryScopeRunner } from './directory-scope-runner';

/**
 * ADR-0079 slice 3 — **the durable READ behind `decideSignIn`.**
 *
 * 🛑 **IT READS AND REACHES NO CONCLUSION.** It does not decide admission, does
 * not compare a scope kind, does not read a clock and does not know that
 * `revokedAt` means anything. Every one of those decisions belongs to
 * `@age/sign-in-directory`, which has exactly one implementation of each —
 * 🚫 a second copy here is how the two drift, and the copy that gets relaxed
 * still passes its own tests.
 *
 * ⚠️ **ROWS ARE UNTRUSTED INPUT AND ARE RE-VALIDATED HERE** (ADR-0031's rule).
 * A row whose shape does not match is DROPPED rather than coerced: a membership
 * missing its `scope_kind` is not an agency membership with a blank kind, and
 * defaulting one would be this module authoring a grant.
 *
 * 🚫 **NO EMAIL NORMALIZATION OF ITS OWN.** The address arrives already lowered
 * by `verifiedGoogleIdentity`, which is the ONE place that decision is taken.
 * Lowering it a second time here would be a second implementation of the same
 * rule, and the day they disagree is the day sign-in works for one operator and
 * not another.
 */

/**
 * Builds the directory read `decideSignIn` is fed from.
 *
 * ⚠️ **THE ORGANIZATION IS BOUND AT CONSTRUCTION**, once, by whoever knows the
 * scope — so the returned function takes an email and nothing else, and 🚫 a
 * caller cannot ask about a tenant it was not built for.
 */
export function signInDirectoryRead(
  runner: DirectoryScopeRunner,
  scope: DirectoryScope,
): (email: string) => Promise<DirectoryEntry> {
  return (email: string): Promise<DirectoryEntry> => entryFor(runner, scope, { email });
}

/**
 * The same directory read, reached by the account id a session row already
 * holds - ADR-0079 §6 slice 4.
 *
 * 🛑 **IT IS THE SAME READ AND FEEDS THE SAME DECISION, DELIBERATELY.**
 * ADR-0079 §2 property 2: *the scope is read from the database on every
 * request, never from a token claim* - so a demoted, revoked or disabled
 * operator loses their reach on the NEXT request. That is only true if the
 * per-request question is the SAME question sign-in asked; a second, gentler
 * re-check here is how the two drift, and the copy that gets relaxed still
 * passes its own tests.
 *
 * 🚫 **IT DECIDES 🚫THING**, exactly as its sibling. It fetches rows;
 * `decideSignIn` reasons over them.
 */
export function directoryEntryByAccountRead(
  runner: DirectoryScopeRunner,
  scope: DirectoryScope,
): (accountId: string) => Promise<DirectoryEntry> {
  return (accountId: string): Promise<DirectoryEntry> => entryFor(runner, scope, { accountId });
}

/**
 * ⚠️ **ONE BODY FOR BOTH DOORS.** The normalization, the drop-a-malformed-row
 * rule and the no-account short circuit are the same facts however the account
 * was named, and two copies of them would be two chances to disagree.
 */
function entryFor(
  runner: DirectoryScopeRunner,
  scope: DirectoryScope,
  where: { readonly email: string } | { readonly accountId: string },
): Promise<DirectoryEntry> {
  return runner.runInScope({ organizationId: scope.organizationId }, async (delegates) => {
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
