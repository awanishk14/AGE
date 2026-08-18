/**
 * `@age/access-scope` — the pure scope model (ADR-0079, slice 1 of §6).
 *
 * 🛑 **THIS PACKAGE NOW HAS EXACTLY ONE CALLER, AND A GUARD PINS IT BY NAME.**
 * Slice 4 wired it, so the "no caller yet" guard was NARROWED rather than
 * deleted: `apps/studio/src/server/request-scope.ts` is the one module permitted
 * to import it, and a second importer fails the guard. 🚫 Importing this from a
 * route, a screen or a query DIRECTLY is still refused - every one of them
 * reaches the decision through that single composed boundary, so there is one
 * place where "which scope is asking" is answered and one place to read when
 * asking whether it is answered correctly.
 *
 * 🚫 **NOTHING HERE ISSUES, STORES, VERIFIES OR REVOKES ANYTHING.** It is the
 * SHAPE of who may reach what, and the refusals that make an unusable scope
 * impossible to construct.
 */

export {
  acceptCapability,
  CapabilityRefusedError,
  CAPABILITY_ATOMS,
  READING_ATOMS,
  ROLE_BUNDLES,
  WRITING_ATOMS,
  type Capability,
  type RoleBundleName,
} from './capabilities';

export {
  acceptAccessScope,
  AccessScopeRefusedError,
  agencyScope,
  clientScope,
  platformScope,
  type AccessScope,
  type AgencyScope,
  type ClientScope,
  type PlatformScope,
} from './access-scope';

export {
  AccessSubjectRefusedError,
  decideAccess,
  type AccessAnswer,
  type AccessDecision,
  type AccessRequest,
  type AccessSubject,
} from './access-decision';

export {
  scopeForMembership,
  type MembershipScopeDecision,
  type ScopeRefusalReason,
  type StoredMembership,
} from './scope-of-membership';
