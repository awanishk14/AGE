/**
 * Capability sufficiency / readiness (ADR-0026, Decision 3).
 *
 * A capability that consumes business context must be able to say, as a normal
 * successful outcome, how far the context it was given actually carried it. This
 * module defines that shared vocabulary — the closed state set, the reasons that
 * explain it, and a small factory that enforces the "always explainable" rule.
 *
 * What this module deliberately does NOT contain:
 *  - threshold or scoring policy. Nothing here maps a score, a field count or a
 *    section count to a state. Whether thresholds are shared across capabilities
 *    or owned per capability is an open decision (ADR-0026 follow-up) and is out
 *    of scope for this contract.
 *  - any knowledge of BIF, ScoredBifContext, or any context source. The contract
 *    is source-neutral: the caller decides the state and states its reasons.
 *  - any clock, randomness, or I/O. Given the same inputs this module produces
 *    the same value, every time.
 *
 * Semantics fixed by ADR-0026:
 *  - `Insufficient` is a SUCCESSFUL, informative outcome. A capability that
 *    cannot responsibly proceed reports it; it does not throw.
 *  - `Blocked` is distinct from `Insufficient`. Insufficient means "the context
 *    given is too thin to conclude"; blocked means "something prevents this run
 *    regardless of how rich the context is".
 *  - Missing context is a limitation, never negative evidence. Reasons describe
 *    what was absent — they never convert absence into a finding.
 */

/**
 * The closed set of sufficiency states. No other value is valid, and this set is
 * not extended per capability.
 */
export enum CapabilitySufficiencyState {
  /** Context supported the capability's full intended output. */
  Ready = 'ready',
  /** Context supported some, but not all, of the intended output. */
  Partial = 'partial',
  /**
   * Context was too thin to conclude anything responsibly. A successful,
   * informative outcome — not an error.
   */
  Insufficient = 'insufficient',
  /**
   * Something prevented the run irrespective of context richness (for example a
   * precondition the caller declares unmet). Distinct from `Insufficient`.
   */
  Blocked = 'blocked',
}

/**
 * All four states, in declaration order. Exported so consumers and tests can
 * assert exhaustiveness without re-listing the set.
 */
export const CAPABILITY_SUFFICIENCY_STATES: readonly CapabilitySufficiencyState[] = [
  CapabilitySufficiencyState.Ready,
  CapabilitySufficiencyState.Partial,
  CapabilitySufficiencyState.Insufficient,
  CapabilitySufficiencyState.Blocked,
];

/**
 * At least one reason. Encoded as a non-empty tuple so "reasons are mandatory"
 * is a compile-time rule for sufficiency-aware code, not only a runtime check.
 */
export type CapabilitySufficiencyReasons = readonly [string, ...string[]];

/**
 * The shared sufficiency record carried alongside a capability's output.
 *
 * Reasons are mandatory for every state, including `Ready` — a capability that
 * claims readiness must say what made it ready, so the claim is auditable rather
 * than assumed.
 */
export interface CapabilitySufficiency {
  readonly state: CapabilitySufficiencyState;
  /** Why the capability is in this state. Always at least one entry. */
  readonly reasons: CapabilitySufficiencyReasons;
  /** Non-blocking caveats about the run. May be empty. */
  readonly warnings: readonly string[];
  /**
   * Optional notes on the quality of the context that was available (coverage,
   * provenance, staleness). Purely descriptive: a note records a limitation, it
   * never asserts a conclusion about the business.
   */
  readonly contextQualityNotes?: readonly string[];
}

export interface CapabilitySufficiencyProps {
  state: CapabilitySufficiencyState;
  reasons: CapabilitySufficiencyReasons;
  warnings?: readonly string[];
  contextQualityNotes?: readonly string[];
}

/**
 * Build a `CapabilitySufficiency`, copying the input arrays so the result cannot
 * be mutated through the caller's references.
 *
 * Throws only on a malformed contract (an unknown state, or no reasons) — never
 * because of the state itself. In particular `Insufficient` and `Blocked` are
 * constructed exactly like `Ready`.
 */
export function createCapabilitySufficiency(
  props: CapabilitySufficiencyProps,
): CapabilitySufficiency {
  if (!CAPABILITY_SUFFICIENCY_STATES.includes(props.state)) {
    throw new Error(
      `createCapabilitySufficiency received an unknown state '${String(props.state)}'; expected one of ${CAPABILITY_SUFFICIENCY_STATES.join(', ')}`,
    );
  }
  if (!Array.isArray(props.reasons) || props.reasons.length === 0) {
    throw new Error(
      `createCapabilitySufficiency requires at least one reason for state '${props.state}'; sufficiency must always be explainable`,
    );
  }

  const [firstReason, ...restReasons] = props.reasons;
  const sufficiency: CapabilitySufficiency = {
    state: props.state,
    reasons: [firstReason, ...restReasons],
    warnings: [...(props.warnings ?? [])],
  };

  // Omitted notes stay omitted rather than becoming an empty array, so "no notes
  // were supplied" and "notes were supplied and were empty" stay distinguishable.
  return props.contextQualityNotes === undefined
    ? sufficiency
    : { ...sufficiency, contextQualityNotes: [...props.contextQualityNotes] };
}
