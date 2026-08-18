/**
 * ADR-0079 slice 3 — **whether a verified identity may become a session.**
 *
 * 🛑 **GOOGLE SAYS WHO. THIS SAYS WHETHER.** The identity is a NAME, proven by
 * Google. Admission is decided from `accounts` and `account_memberships`, rows a
 * human provisioned — **AGE mints nothing, and verification is not issuance.**
 * A person with a perfectly valid Google account and no row here is refused,
 * and 🚫 nothing in this module can create the row that would admit them.
 *
 * 🛑 **SCOPE IS READ FROM THE DATABASE, NEVER FROM THE CREDENTIAL** (ADR-0079
 * §2). Nothing Google returned contributes to what the person may reach.
 *
 * Pure: no clock (`now` arrives), no I/O, no database, no randomness.
 */

/** An `accounts` row, as the directory read returns it. 🚫 Untrusted input, re-validated here. */
export interface DirectoryAccount {
  readonly accountId: string;
  readonly email: string;
  readonly disabledAt: string | null;
}

/** An `account_memberships` row, likewise. */
export interface DirectoryMembership {
  readonly membershipId: string;
  readonly accountId: string;
  readonly scopeKind: string;
  readonly organizationId: string | null;
  readonly clientId: string | null;
  readonly roleBundle: string;
  readonly revokedAt: string | null;
}

/** What the directory read found for one email, inside one organization. */
export interface DirectoryEntry {
  readonly account: DirectoryAccount | undefined;
  readonly memberships: readonly DirectoryMembership[];
}

/**
 * 🚫 **NOT A SESSION AND 🚫 NOT AN AUTHORIZATION.** It names the account and the
 * membership that admitted them, so issuance has something to write down. What
 * that membership PERMITS is `@age/access-scope`'s answer in slice 4 — 🚫 not
 * this module's, and 🚫 not today's.
 */
export interface AdmittedOperator {
  readonly accountId: string;
  readonly organizationId: string;
  readonly membershipId: string;
  readonly roleBundle: string;
  /**
   * ⚠️ **CARRIED FROM SLICE 4, AND THEY ARE THE ROW'S WORDS, 🚫 NOT A
   * CONCLUSION.** `scopeForMembership` turns them into a scope, in its own pure
   * package, afterwards. Reporting them here rather than re-reading the row
   * downstream is what keeps ONE admission decision: the fields a scope is built
   * from are the fields admission already looked at.
   */
  readonly scopeKind: string;
  /** ⚠️ `null` for an agency membership. 🚫 An absent client is never "all clients". */
  readonly clientId: string | null;
}

export type SignInDecision =
  | { readonly outcome: 'admitted'; readonly operator: AdmittedOperator }
  | { readonly outcome: 'refused'; readonly reason: SignInRefusalReason };

/**
 * ⚠️ **DISTINCT INSIDE, COLLAPSED ON THE WAY OUT.** The sign-in page shows one
 * unchanging refusal; these reasons exist so a host operator reading the server
 * side can tell "nobody provisioned this person" from "their membership was
 * revoked", which are the same screen and completely different problems.
 */
export type SignInRefusalReason =
  | 'no-account'
  | 'account-disabled'
  | 'no-membership'
  | 'membership-revoked'
  | 'ambiguous-membership'
  | 'client-scope-not-yet-served'
  | 'platform-scope-not-yet-readable';

/**
 * Decides whether a verified identity is admitted to ONE organization.
 *
 * 🛑 **THE ORGANIZATION IS AN INPUT, 🚫 NOT A SEARCH RESULT, AND THAT IS A
 * MEASURED CONSTRAINT RATHER THAN A PREFERENCE.** Slice 2's read policy on
 * `account_memberships` is `organization_id = current_setting('age.organization_id')`,
 * so `age_app` cannot ask "which organization does this email belong to" — an
 * unscoped read returns nothing, and a scoped one already knows the answer.
 * This deployment pins one organization, so slice 3 admits into that one.
 * ⚠️ Discovering an operator's organization ACROSS tenants needs a read path
 * that does not exist and 🚫 must not be invented by widening a shipped policy.
 *
 * 🛑 **AND PLATFORM MEMBERSHIPS ARE UNREADABLE FULL STOP.** They carry
 * `organization_id IS NULL`, and NULL never equals the scope, so no scoped read
 * can return one. Super-admin sign-in therefore does 🚫 NOT work after this
 * slice; that is stated here, refused by name below, and is the subject of a
 * `Proposed` ADR rather than a quiet policy change.
 */
export function decideSignIn(entry: DirectoryEntry, organizationId: string): SignInDecision {
  const account = entry.account;

  if (account === undefined) return refused('no-account');
  if (account.disabledAt !== null) return refused('account-disabled');

  const mine = entry.memberships.filter((membership) => membership.accountId === account.accountId);

  if (mine.length === 0) return refused('no-membership');

  // 🛑 Refused BEFORE the live filter, so "your membership was revoked" cannot
  // be reported as "you were never provisioned" — different problems, and the
  // host operator has to be able to tell them apart.
  const live = mine.filter((membership) => membership.revokedAt === null);

  if (live.length === 0) return refused('membership-revoked');

  if (live.some((membership) => membership.scopeKind === 'platform')) {
    return refused('platform-scope-not-yet-readable');
  }

  const agency = live.filter(
    (membership) =>
      membership.scopeKind === 'agency' && membership.organizationId === organizationId,
  );

  if (agency.length === 0) {
    // 🛑 A client membership is refused rather than admitted, and 🚫 not
    // silently: the console renders agency views only, so admitting a client
    // today would show them an agency's screens. Client sign-in arrives with
    // the client rendering, 🚫 never before it.
    return refused(
      live.some((membership) => membership.scopeKind === 'client')
        ? 'client-scope-not-yet-served'
        : 'no-membership',
    );
  }

  // 🛑 **TWO LIVE MEMBERSHIPS ARE REFUSED, 🚫 NEVER PICKED BETWEEN.** Choosing
  // one would be this module deciding which role bundle a person signs in with,
  // and it would choose the same way every time — silently, and invisibly to
  // whoever provisioned the second row by mistake.
  if (agency.length > 1) return refused('ambiguous-membership');

  const admitting = agency[0] as DirectoryMembership;

  return Object.freeze({
    outcome: 'admitted' as const,
    operator: Object.freeze({
      accountId: account.accountId,
      organizationId,
      membershipId: admitting.membershipId,
      roleBundle: admitting.roleBundle,
      scopeKind: admitting.scopeKind,
      clientId: admitting.clientId,
    }),
  });
}

function refused(reason: SignInRefusalReason): SignInDecision {
  return Object.freeze({ outcome: 'refused' as const, reason });
}
