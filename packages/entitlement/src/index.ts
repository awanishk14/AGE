/**
 * `@age/entitlement` — the entitlement question and nothing else
 * (ADR-0058 D8 item 1).
 *
 * 🚫 THIS PACKAGE HAS NO CALLER, DELIBERATELY, AND A GUARD ASSERTS IT. Importing
 * it from a route, a screen, a query or a middleware is 🚫 not authorized by
 * ADR-0058 — that needs its own `Status: Proposed` ADR (§5), and 🛑 ADR-0055 D7
 * is still undischarged besides.
 */

export {
  askEntitlement,
  NO_AUTHENTICATION,
  type Authentication,
  type EntitlementAnswer,
  type EntitlementDecision,
  type EntitlementQuestion,
  type EntitlementSubject,
} from './entitlement-question';
