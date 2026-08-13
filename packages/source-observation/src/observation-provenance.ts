/**
 * WHO said it (ADR-0066 D6).
 *
 * 🛑 **AN INCOMPLETE PROVENANCE IS REFUSED, NEVER DOWNGRADED.** There is no
 * `unknown-source` arm, no anonymous arm and no default `sourceSystem`. An
 * unidentified inbound source is refused — that rule already governs the
 * provenance channel and it governs this envelope identically.
 *
 * 🛑 **AGE-INV-PROV-1 IS UNTOUCHED BY THIS FILE: provenance alone never changes
 * a score.** Two observations identical but for their `sourceSystem` must
 * produce byte-identical downstream results. Nothing here may be read as
 * weighting, trust or precedence — 🚫 there is deliberately no `trustLevel`,
 * `weight`, `priority` or `rank` field, and adding one would break the invariant
 * by making the source, rather than the claim, decide what AGE concludes.
 *
 * 🚫 **`sourceSystem` IS DATA, NEVER A BRANCH** (ADR-0069 D6). No module in the
 * core may switch on it. A sixth peer product is a new value, 🚫 never a new code
 * path.
 *
 * Pure: no clock, no ids, no randomness, no I/O.
 */

export interface ObservationProvenance {
  /**
   * The peer product that observed it — e.g. `rankops`, `mcp-ads-server`.
   * ⚠️ A free string ON PURPOSE: an enum here would mean a third-party
   * integration required an AGE release, which is the coupling ADR-0069 D6
   * exists to prevent.
   */
  readonly sourceSystem: string;
  /** Which deployment/account of that product. 🚫 Never defaulted. */
  readonly sourceInstance: string;
  /**
   * The source's own id for the record this observation summarises.
   * 🛑 **AGE STORES THE REFERENCE, NEVER THE CORPUS** — this id is how a curious
   * operator gets back to the 50,000 rows, which stay in the source system.
   */
  readonly sourceRecordId: string;
  /** The organisation this observation is about, as the source asserted it. */
  readonly organizationScope: string;
}

/**
 * What the source is claiming its statement IS (ADR-0066 D5).
 *
 * ⚠️ `source-derived-intelligence` means the peer product already reasoned to
 * this — it is that product's conclusion, 🚫 not a raw reading. AGE keeps the
 * distinction because a conclusion built on other systems' conclusions is a
 * weaker thing than one built on their observations, and a reader must be able
 * to see which they are looking at. 🚫 The two are never merged and neither is
 * ever the default for the other.
 */
export type ClaimKind = 'raw-observation' | 'source-derived-intelligence';

export const CLAIM_KINDS: readonly ClaimKind[] = Object.freeze([
  'raw-observation',
  'source-derived-intelligence',
]);

/** The provenance fields, named in a fixed order for refusal POSITIONS. */
export const PROVENANCE_FIELDS: readonly (keyof ObservationProvenance)[] = Object.freeze([
  'sourceSystem',
  'sourceInstance',
  'sourceRecordId',
  'organizationScope',
]);
