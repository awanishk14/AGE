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
  /**
   * 🛑 **`null` MEANS THIS SESSION BELONGS TO NO ORGANIZATION, AND THAT IS A
   * FACT ABOUT IT — 🚫 NOT A MISSING VALUE** (ADR-0082 D1/D4). A platform
   * operator has no organization; `platformScope()` in `@age/access-scope` has
   * taken no arguments since ADR-0079 slice 1, for exactly this reason.
   *
   * 🚫 **NEVER DEFAULT IT, COALESCE IT OR RENDER IT AS A TENANT.** A reader that
   * finds `null` where it expected a tenant **refuses**; 🚫 it does not
   * substitute one. ⚠️ `organizationId ?? something` anywhere downstream is
   * this decision being undone.
   */
  readonly organizationId: string | null;
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
  /**
   * 🛑 **A CLIENT MEMBERSHIP THAT NAMES NO CLIENT IS REFUSED, 🚫 NOT WIDENED TO
   * THE AGENCY IT SITS BENEATH.** ADR-0088. An absent client is 🚫 never "all
   * clients" — the constitution's *absence is never a conclusion*, applied to a
   * row. Such a row cannot come from a coherent provisioning step; the database
   * CHECK constraint requires a client on a client-scoped membership, so if one
   * arrives the reader is not the one the product thinks it is.
   */
  | 'incoherent-client-membership'
  /**
   * 🛑 **A PLATFORM MEMBERSHIP THAT CARRIES AN ORGANIZATION OR A CLIENT IS
   * REFUSED, 🚫 NOT NARROWED TO THE PART THAT MAKES SENSE.** ADR-0082 D4 says a
   * reader that finds NULL where it expected a tenant refuses; the converse is
   * the same rule. Such a row cannot come from the shipped read path — its
   * policy requires `organization_id IS NULL` — so if one ever arrives, the
   * reader is not the one the product thinks it is, and 🚫 guessing which half
   * of the row to believe is how a platform session acquires a tenant.
   */
  | 'incoherent-platform-membership'
  /**
   * 🛑 **A CHANNEL ANSWERED WITH THE OTHER CHANNEL'S KIND OF MEMBERSHIP.**
   * The tenant read cannot return a platform row (its policy compares
   * `organization_id` for equality, and NULL never equals anything) and the
   * fenced platform read sets 🚫 no `age.organization_id` at all, so neither
   * can. ⚠️ If one ever does, the reader is not the one the product thinks it
   * is — and 🚫 believing the row anyway is how a platform session acquires a
   * tenant, or a tenant session loses one.
   */
  | 'crossed-directory-channel';

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
 * 🛑 **A PLATFORM MEMBERSHIP IS NOT REACHED THROUGH THAT INPUT AT ALL**
 * (ADR-0080, ADR-0082). It carries `organization_id IS NULL`, and NULL never
 * equals the scope, so 🚫 no scoped read can return one — the platform rows
 * arrive only from the separately fenced read, and they are admitted here with
 * 🚫 **no organization**, 🚫 never with the pinned one.
 *
 * ⚠️ **SO `organizationId` IS THE TENANT QUESTION AND ONLY THE TENANT
 * QUESTION.** It is ignored on the platform path, deliberately: an argument that
 * quietly became this session's organization is precisely the substitution
 * ADR-0082 D4 forbids.
 *
 * 🛑 **`null` MEANS THERE IS NO TENANT CHANNEL — 🚫 NOT "ANY TENANT"** (ADR-0089
 * §5.3). A platform request re-reading its own membership has 🚫 no organization
 * to ask about, and ADR-0082 D4's rule is that such an absence is **expressed,
 * 🚫 never substituted**. So the caller passes `null` rather than the pinned
 * organization, and the tenant filter below matches **nothing**: a tenant
 * membership handed to this function with `null` is **refused**, never admitted.
 * ⚠️ That is the whole reason this is a widened parameter rather than a second
 * function — two implementations of *"may this person be here"* is how the two
 * drift, and the copy that gets relaxed still passes its own tests.
 */
export function decideSignIn(entry: DirectoryEntry, organizationId: string | null): SignInDecision {
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

  const platform = live.filter((membership) => membership.scopeKind === 'platform');

  if (platform.length > 0) {
    // 🛑 **A PLATFORM MEMBERSHIP ALONGSIDE ANY OTHER LIVE MEMBERSHIP IS AN
    // AMBIGUITY, 🚫 NOT A PRECEDENCE.** Ranking platform above agency would be
    // this module deciding that the wider row wins, silently and the same way
    // every time — and it would decide it in favour of the widest scope AGE
    // has. Whoever provisioned the second row has to see the refusal.
    if (live.length > platform.length || platform.length > 1)
      return refused('ambiguous-membership');

    const admitting = platform[0] as DirectoryMembership;

    // 🚫 Rows are UNTRUSTED INPUT, re-validated on read, and this is the one
    // shape that would turn a platform session into a tenant one.
    if (admitting.organizationId !== null || admitting.clientId !== null) {
      return refused('incoherent-platform-membership');
    }

    // ⚠️ `null`, and 🚫 NOT `organizationId`. ADR-0082 D4.
    return admittedAs(account.accountId, null, admitting);
  }

  // 🛑 **CLIENTS ARE ADMITTED SINCE ADR-0088, AND THE REFUSAL THEY USED TO GET
  // NAMED THE CONDITION OF ITS OWN REMOVAL** — *"the console renders agency
  // views only […] Client sign-in arrives with the client rendering, 🚫 never
  // before it."* ADR-0087 shipped that rendering, and ADR-0088 §2 put a gate in
  // front of the fifteen agency pages so the first half of that sentence stopped
  // being true as well. 🚫 Neither half was lifted without the other.
  // 🛑 **`null` MATCHES NOTHING HERE, AND THE EMPTY LIST IS WRITTEN OUT RATHER
  // THAN LEFT TO `=== null`** (ADR-0089 §5.3). Rows are UNTRUSTED INPUT: a row
  // carrying `scope_kind = 'agency'` with a NULL `organization_id` is a row
  // nothing in the product can express, and an equality test alone would admit
  // it to a request that HAS no organization. ⚠️ That is the ADR-0082 D4
  // substitution arriving through the back door — absence matching absence and
  // becoming a tenant. 🚫 A request with no organization admits no tenant
  // membership, whatever the row says.
  const tenant =
    organizationId === null
      ? []
      : live.filter((membership) => membership.organizationId === organizationId);

  const agency = tenant.filter((membership) => membership.scopeKind === 'agency');
  const client = tenant.filter((membership) => membership.scopeKind === 'client');

  if (agency.length === 0 && client.length === 0) return refused('no-membership');

  // 🛑 **TWO LIVE MEMBERSHIPS ARE REFUSED, 🚫 NEVER PICKED BETWEEN.** Choosing
  // one would be this module deciding which role bundle a person signs in with,
  // and it would choose the same way every time — silently, and invisibly to
  // whoever provisioned the second row by mistake.
  //
  // ⚠️ **AN AGENCY ROW AND A CLIENT ROW TOGETHER ARE COUNTED HERE, WHICH THEY
  // WERE NOT BEFORE** (ADR-0088 §3c). The agency row used to win silently. That
  // was harmless only while a client row could admit nobody; now it is exactly
  // the question the platform arm above already refuses by name. 🛑 This is a
  // NARROWING — a combination that used to be admitted is now refused, and 🚫
  // nothing that was refused became admitted.
  if (agency.length + client.length > 1) return refused('ambiguous-membership');

  if (agency.length === 1) {
    return admittedAs(account.accountId, organizationId, agency[0] as DirectoryMembership);
  }

  const admitting = client[0] as DirectoryMembership;

  // 🚫 Rows are UNTRUSTED INPUT, re-validated on read. A client membership with
  // no client is 🚫 not "every client" and 🚫 not the agency it sits beneath —
  // it is a row nothing in the product can express as a scope, and
  // `scopeForMembership` would refuse it downstream. ⚠️ Refusing it HERE means
  // no session is ever issued against it.
  if (admitting.clientId === null) return refused('incoherent-client-membership');

  return admittedAs(account.accountId, organizationId, admitting);
}

/**
 * ⚠️ **ONE ADMISSION SHAPE, BUILT IN ONE PLACE.** Two copies would be two
 * chances for the platform one to grow a field the tenant one lacks, and the
 * copy that drifts still passes its own test.
 */
function admittedAs(
  accountId: string,
  organizationId: string | null,
  admitting: DirectoryMembership,
): SignInDecision {
  return Object.freeze({
    outcome: 'admitted' as const,
    operator: Object.freeze({
      accountId,
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

/**
 * The two directory channels, decided together — ADR-0080 (the fenced platform
 * read) meeting ADR-0082 (the session that belongs to no organization).
 *
 * 🛑 **BOTH CHANNELS ARE ALWAYS READ, AND NEITHER RANKS ABOVE THE OTHER.** The
 * tenant read cannot see a platform membership and the fenced platform read
 * cannot see a tenant one, so "which one do we ask first" would silently be
 * "which membership wins" — and `decideSignIn` already refuses that question
 * inside one entry, by name. ⚠️ The rule is the same rule, applied across the
 * two reads: 🚫 two live memberships are refused, 🚫 never picked between.
 *
 * 🚫 **IT DECIDES NOTHING NEW.** Every admission and every refusal below is
 * `decideSignIn`'s, unchanged; this composes two of its answers and 🚫 does not
 * form a third opinion about either.
 */
export function decideSignInAcrossDirectories(
  tenantEntry: DirectoryEntry,
  platformEntry: DirectoryEntry,
  organizationId: string,
): SignInDecision {
  const tenant = decideSignIn(tenantEntry, organizationId);
  const platform = decideSignIn(platformEntry, organizationId);

  // 🛑 **AN ADMISSION FROM THE WRONG CHANNEL IS REFUSED, 🚫 NOT ACCEPTED FOR
  // ITS SHAPE.** A tenant admission carries an organization and a platform
  // admission carries none; the converse in either direction means the row came
  // back through a read that should not have been able to return it.
  if (tenant.outcome === 'admitted' && tenant.operator.organizationId === null) {
    return refused('crossed-directory-channel');
  }

  if (platform.outcome === 'admitted' && platform.operator.organizationId !== null) {
    return refused('crossed-directory-channel');
  }

  // 🛑 Provisioned in both places is an AMBIGUITY, 🚫 not a precedence. Whoever
  // created the second membership has to see the refusal.
  if (tenant.outcome === 'admitted' && platform.outcome === 'admitted') {
    return refused('ambiguous-membership');
  }

  if (platform.outcome === 'admitted') return platform;
  if (tenant.outcome === 'admitted') return tenant;

  // ⚠️ **`no-account` IS THE ABSENCE OF A CHANNEL, 🚫 NOT A FINDING ABOUT THE
  // PERSON.** A platform operator is simply not in the tenant directory, and a
  // tenant operator is not in the platform one — so when one channel says only
  // that, the OTHER channel's reason is the one a host operator can act on.
  if (tenant.outcome === 'refused' && tenant.reason === 'no-account') return platform;

  return tenant;
}
