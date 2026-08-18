/**
 * `@age/access-scope` — the pure scope model (ADR-0079, slice 1 of §6).
 *
 * 🚫 **THIS PACKAGE HAS NO CALLER YET, DELIBERATELY, AND A GUARD ASSERTS IT.**
 * ADR-0079 authorizes the MODEL and nothing else. Accounts, memberships and
 * session issuance are slice 2; sign-in is slice 3; re-scoping the existing
 * reads is slice 4 and is the dangerous one. Importing this from a route, a
 * screen or a query today would re-scope a read path without any of the guards
 * those slices owe.
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
