import { redirect } from 'next/navigation';

import { decideSignIn } from '@age/sign-in-directory';

import { readPlatformDirectoryEntryByAccount } from './operator-environment';

/**
 * **DOES THIS PLATFORM PRINCIPAL STILL HOLD A LIVE MEMBERSHIP?** — ADR-0089,
 * asked on EVERY request that takes a platform decision.
 *
 * 🛑 **ONE IMPLEMENTATION, BECAUSE TWO WOULD AGREE ONLY TODAY.** `request-scope`
 * had this inline and `session-boundary` had nothing, so `/platform` and
 * `/platform/choose` took a platform decision from the SESSION ROW alone — a
 * credential — while `/` took it from the database. ADR-0079 §2 property 2 says
 * scope is read from the database on every request, and a gate that reads it
 * from a token is the property being undone in the one place nobody looked.
 * 🚫 Do not re-inline this in either caller.
 *
 * 🛑 **IT LIVES IN ITS OWN MODULE TO AVOID A CYCLE, 🚫 NOT TO BE A THIRD
 * BOUNDARY.** `request-scope` imports `session-boundary`, so the shared piece
 * cannot live in either. It decides NOTHING that its callers do not already
 * decide; it only refuses to let them decide it twice.
 *
 * 🚫 **IT IS NOT AN AUTHORIZATION.** It answers *"is this membership still
 * live?"*, 🚫 never *"what may they reach?"* — that stays `decideAccess` over
 * capability atoms in `request-scope`, and admin is never a bypass (ADR-0062 D3).
 */

/**
 * Returns for a platform principal whose membership is still live, or does not
 * return.
 *
 * ⚠️ **KEYED BY THE ACCOUNT ID THE SESSION ALREADY PROVED**, and 🚫 there is no
 * parameter through which a tenant could be supplied. The organization-scoped
 * read cannot be borrowed here: passing the pinned organization is exactly the
 * substitution ADR-0082 D4 forbids, and it would read an agency's people.
 *
 * ⚠️ `null` is 🚫 not a default and 🚫 not a wildcard. This request has NO
 * organization, so the tenant arm of `decideSignIn` matches nothing and refuses.
 * A platform operator whose membership was revoked since sign-in reads as
 * ABSENT and is refused on the NEXT REQUEST — 🚫 not at eight-hour expiry — with
 * the session row still perfectly valid.
 *
 * 🛑 **IT FAILS CLOSED.** The ADR-0089 RLS policy shows this reader nothing
 * unless the transaction-local fence names the proved account, so a read that
 * loses its fence returns an absent entry and REFUSES. 🚫 It never widens.
 */
export async function requireLivePlatformMembership(accountId: string): Promise<void> {
  const entry = await readPlatformDirectoryEntryByAccount(accountId);

  // 🛑 THE SAME DECISION, OVER FRESHLY READ ROWS, AND 🚫 NOT A GENTLER COPY.
  if (decideSignIn(entry, null).outcome === 'refused') {
    // ⚠️ The same destination and the same silence as every other refusal here.
    // 🚫 The operator is never told WHICH refusal applied.
    redirect('/sign-in?refused=not-provisioned');
  }
}
