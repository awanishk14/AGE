/**
 * `@age/entitlement` — the entitlement question and nothing else
 * (ADR-0058 D8 item 1).
 *
 * 🚫 THIS PACKAGE STILL HAS NO CALLER, DELIBERATELY, AND A GUARD ASSERTS IT.
 * ADR-0061 A3 authorizes the DECISION — the authenticated arm and real `granted`
 * and `denied` — and 🚫 nothing else. Importing it from a route, a screen, a
 * query or a middleware needs the slice that builds the session store and says
 * so; 🛑 ADR-0055 D7 is still undischarged besides.
 *
 * 🚫 NOTHING HERE ISSUES, STORES, VERIFIES OR REVOKES A SESSION. This package is
 * guarded against performing any effect at all, and a session store is entirely
 * effects.
 */

export {
  acceptVerifiedPlatformSession,
  acceptVerifiedSession,
  authenticatedOrganizationIdOf,
  SessionRefusedError,
  type AuthenticatedOrganizationId,
  type VerifiedPlatformSession,
  type VerifiedSession,
} from './verified-session';

export {
  askEntitlement,
  NO_AUTHENTICATION,
  type Authentication,
  type EntitlementAnswer,
  type EntitlementDecision,
  type EntitlementQuestion,
  type EntitlementSubject,
} from './entitlement-question';
