import type { MarketSignal } from './market-signal';

/**
 * MarketDiscoveryInput — the in-memory input contract for a single Market
 * Discovery invocation (ADR-0012). Caller-assembled; Market Discovery reads no
 * datastore and does not depend on persisted Intelligence output.
 *
 * `generatedAt` is the caller-supplied run timestamp (ISO); it is the only time
 * source the capability uses (e.g. for output-item createdAt) — no internal
 * clock reads.
 *
 * Client/organization authority invariant (enforced from T15 onward, not by
 * this contract type):
 *  - `ClientContext.clientId` / `ClientContext.organizationId` are AUTHORITATIVE
 *    for the produced `CapabilityOutput`.
 *  - `MarketDiscoveryInput.clientId` / `MarketDiscoveryInput.organizationId` are
 *    PROVENANCE / SCOPE fields describing the input batch, matching the
 *    EvidencePackage precedent.
 *  - If future pipeline validation compares the two and finds a mismatch, that
 *    must be handled by an explicit validation rule (and, if it changes
 *    behavior, an ADR update) — never silently ignored or guessed.
 */
export interface MarketDiscoveryInput {
  readonly clientId: string;
  readonly organizationId: string;
  readonly signals: readonly MarketSignal[];
  readonly generatedAt: string;
}
