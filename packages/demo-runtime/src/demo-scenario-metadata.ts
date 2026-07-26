/**
 * Demo scenario metadata (ADR-0039, Accepted).
 *
 * Canonical Path B mapping (`produceScoredBifContext`) requires three values the
 * discovery profile does not carry: `organizationId`, `constructedAt` and
 * `changedBy`. ADR-0038 D6 forbids inventing them anywhere downstream — not in
 * the mapper, not as Path B defaults, not as optional inputs. ADR-0039 resolves
 * that by making the demo declare them itself, here, in the open.
 *
 * THIS IS SCENARIO METADATA, NOT PRODUCTION TENANT IDENTITY. `organizationId`
 * below names a fictional organization that exists only in the demo fixture; it
 * is not a tenant, it is not scope, and it must never be treated as one. Real
 * scope comes from `ClientContext` (ADR-0030) and is not wired here — the demo
 * persists nothing and reads nothing scoped, so it has no tenancy to model, and
 * inventing one would be the same fabrication in a different costume.
 *
 * `constructedAt` is a FIXED timestamp, deliberately not `new Date()`. The demo
 * is byte-deterministic and the mapper reads no clock on purpose; a live clock
 * here would destroy both. A declared scenario time is not a fake reading, the
 * same way the sample profile's own `capturedAt` is not.
 *
 * It is a value, not a lookup: pure, frozen, no I/O, no clock, no randomness.
 */

/** The three caller-supplied values canonical Path B mapping requires. */
export interface DemoScenarioMetadata {
  /** Fictional demo-scenario organization. NOT a tenant id and never scope. */
  readonly organizationId: string;
  /** Fixed scenario construction time — never a wall-clock read. */
  readonly constructedAt: Date;
  /** Named fictional demo actor recorded as the author of the mapping. */
  readonly changedBy: string;
}

/**
 * The one demo scenario. Passed explicitly into the demo pipeline (ADR-0039 D3)
 * rather than reached for from inside it, so the value is visible at the call
 * site and a test can supply a different one.
 */
export const DEMO_SCENARIO_METADATA: DemoScenarioMetadata = Object.freeze({
  organizationId: 'demo-scenario-organization',
  constructedAt: new Date('2026-01-01T00:00:00.000Z'),
  changedBy: 'demo-scenario-operator',
});
