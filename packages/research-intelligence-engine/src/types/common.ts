/** Opaque raw payload returned by a source before normalization. */
export type RawData = Readonly<Record<string, unknown>>;

/**
 * Metadata is a canonical evidence contract type owned by
 * @age/evidence-contracts (ADR-0010). Re-exported here so existing internal
 * imports (`../types/common`) keep working unchanged.
 */
export type { Metadata } from '@age/evidence-contracts';
