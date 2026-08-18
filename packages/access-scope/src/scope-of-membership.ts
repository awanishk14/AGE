/**
 * From a stored membership to a scope — ADR-0079 §6 slice 4.
 *
 * 🛑 **A STORED ROW IS UNTRUSTED INPUT, AND THIS IS THE ONLY PLACE IT BECOMES A
 * SCOPE.** Two copies of this mapping is how the two disagree, and the copy that
 * gets relaxed still passes its own tests. A guard pins it to one file.
 *
 * 🛑 **A ROW THAT SAYS `platform` DOES 🚫 NOT BECOME PLATFORM ACCESS HERE.**
 * `platformScope()` takes no arguments and is reachable only by NAME (see
 * `access-scope.ts`); making it reachable by PARSING would be exactly the
 * widening that design exists to prevent. A platform membership is REFUSED by
 * this function — the same word sign-in already uses for it — and 🚫 the fix is
 * never to call `platformScope()` from inside a parser.
 *
 * 🛑 **THE BUNDLE MUST MATCH THE KIND, AND A MISMATCH IS REFUSED RATHER THAN
 * RESOLVED.** The scope constructors resolve their own bundle, so a row naming a
 * different one cannot be honoured — and honouring the constructor's bundle
 * anyway would silently grant atoms nobody assigned, or silently withhold atoms
 * somebody did. ⚠️ Both directions are wrong, which is why neither is taken.
 *
 * 🚫 **ABSENCE IS NEVER A CONCLUSION.** A missing organization is not "all
 * organizations" and a missing client is not "all clients"; each is refused by
 * position, 🚫 never defaulted.
 *
 * Pure: no clock, no ids, no randomness, no I/O.
 */

import { agencyScope, clientScope, type AccessScope } from './access-scope';

/**
 * The fields of one `account_memberships` row that bear on reach.
 *
 * ⚠️ Deliberately PRIMITIVES rather than a row type imported from a directory
 * package: this package declares no dependencies at all, and a scope must not
 * learn what a database is in order to be constructed.
 */
export interface StoredMembership {
  readonly scopeKind: string;
  readonly roleBundle: string;
  readonly organizationId: string | null;
  readonly clientId: string | null;
}

/**
 * Why a stored membership did not become a scope.
 *
 * ⚠️ Each reason names a POSITION or a RELATIONSHIP and 🚫 never an identifier
 * (ADR-0054 D3), so a refusal can be logged without putting a real organization
 * or client into the record.
 */
export type ScopeRefusalReason =
  | 'unknown-scope-kind'
  | 'platform-scope-not-reachable-by-parsing'
  | 'bundle-does-not-match-scope-kind'
  | 'missing-organization'
  | 'missing-client'
  | 'organization-is-not-the-scope-read';

export type MembershipScopeDecision =
  | { readonly outcome: 'scoped'; readonly scope: AccessScope }
  | { readonly outcome: 'refused'; readonly reason: ScopeRefusalReason };

const refused = (reason: ScopeRefusalReason): MembershipScopeDecision =>
  Object.freeze({ outcome: 'refused' as const, reason });

/**
 * Turns one stored membership into the scope it stands for, inside the
 * organization the read was scoped to.
 *
 * 🛑 **THE ORGANIZATION IS AN INPUT AND IS COMPARED, 🚫 NOT ADOPTED FROM THE
 * ROW.** The row arrived from a read already scoped to `readOrganizationId`, so
 * a row naming a different one is not a wider grant — it is a contradiction, and
 * it is refused. ⚠️ Adopting the row's value instead would let whatever produced
 * the row choose the tenant, which is the chain AGE-INV-SEL-1 forbids.
 */
export function scopeForMembership(
  membership: StoredMembership,
  readOrganizationId: string,
): MembershipScopeDecision {
  switch (membership.scopeKind) {
    case 'platform':
      return refused('platform-scope-not-reachable-by-parsing');

    case 'agency': {
      if (membership.roleBundle !== 'agency-operator') {
        return refused('bundle-does-not-match-scope-kind');
      }
      if (membership.organizationId === null) return refused('missing-organization');
      if (membership.organizationId !== readOrganizationId) {
        return refused('organization-is-not-the-scope-read');
      }

      return Object.freeze({
        outcome: 'scoped' as const,
        scope: agencyScope(membership.organizationId),
      });
    }

    case 'client': {
      if (membership.roleBundle !== 'client-viewer') {
        return refused('bundle-does-not-match-scope-kind');
      }
      if (membership.organizationId === null) return refused('missing-organization');
      if (membership.organizationId !== readOrganizationId) {
        return refused('organization-is-not-the-scope-read');
      }
      if (membership.clientId === null) return refused('missing-client');

      return Object.freeze({
        outcome: 'scoped' as const,
        scope: clientScope(membership.organizationId, membership.clientId),
      });
    }

    default:
      // ⚠️ **THE ONE PLACE A `default` IS CORRECT, AND IT REFUSES.** Elsewhere in
      // this package a `default` arm would answer a question nobody thought
      // about; here the input is an arbitrary STRING off a database row, so
      // there is no exhaustiveness to preserve — and the answer it gives is the
      // refusal, 🚫 never a fallback scope.
      return refused('unknown-scope-kind');
  }
}
