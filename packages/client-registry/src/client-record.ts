import { ClientContext } from '@age/capability-kit';
import { z } from 'zod';

/**
 * ClientRecord — the AGE-side identity of a real business, and the ONLY place
 * where the correspondence between AGE and the external systems lives
 * (ADR-0053 D1, D2).
 *
 * ⚠️ This is NOT the ADR-0009 `Client` aggregate and must not become one.
 * ADR-0009 remains reserved. A record carries no lifecycle, no status, no
 * `Draft → Active`, and no business attributes — it answers "which scope, and
 * what is this business called elsewhere" and nothing more. The moment a field
 * appears here that a capability would reason over, the wrong thing is being
 * built: that fact belongs in the BIF, where it gains provenance, confidence
 * and version history.
 */

const nonEmpty = (label: string) => z.string().trim().min(1, `${label} must be a non-empty string`);

/**
 * The map from a system key to that system's OWN identifier for the business.
 *
 * ⚠️ Deliberately open, not an enum of blessed systems (ADR-0053 D2): keys are
 * validated as non-empty strings, never checked against a list. New tools will
 * be added, and adding one must not require editing AGE.
 *
 * ⚠️ AGE holds the mapping and the external systems change nothing. AGE is the
 * newcomer and therefore AGE absorbs the translation — the dependency arrow
 * points from AGE outward and never back (ADR-0053 D7).
 */
export const externalRefsSchema = z.record(
  nonEmpty('an externalRefs key'),
  nonEmpty('an externalRefs value'),
);

export const clientRecordSchema = z
  .object({
    clientId: nonEmpty('clientId'),
    organizationId: nonEmpty('organizationId'),
    displayName: nonEmpty('displayName'),
    externalRefs: externalRefsSchema,
  })
  .strict();

export type ClientRecord = Readonly<z.infer<typeof clientRecordSchema>>;

/**
 * Parse an untrusted value into a ClientRecord.
 *
 * Records arrive from outside the repository (ADR-0053 D3 — real records are
 * never committed), so every record is untrusted input and is validated at the
 * boundary rather than trusted because of where it came from.
 */
export function parseClientRecord(value: unknown): ClientRecord {
  return Object.freeze(clientRecordSchema.parse(value));
}

/**
 * Resolve a record to the scoping context every capability invocation takes.
 *
 * This is the whole point of the package: a real business becomes a value that
 * can be passed, instead of a constant compiled into the demo.
 */
export function toClientContext(record: ClientRecord): ClientContext {
  return new ClientContext(record.clientId, record.organizationId);
}

/**
 * Look a record up by its AGE clientId.
 *
 * ⚠️ Returns `undefined` for an unknown id and never invents a record. An
 * unknown client is a missing fact, not a new client — fabricating one here
 * would put a scope into circulation that names nothing.
 */
export function findClientRecord(
  records: readonly ClientRecord[],
  clientId: string,
): ClientRecord | undefined {
  return records.find((record) => record.clientId === clientId);
}

/**
 * Look up one external reference for a record.
 *
 * ⚠️ Returns `undefined` when the system is not mapped. A business that has no
 * Meta ad account is not a business with an empty Meta ad account, and the
 * caller must be able to tell those apart (ADR-0026 D4 — absence is a
 * limitation, never a conclusion).
 */
export function findExternalRef(record: ClientRecord, systemKey: string): string | undefined {
  return record.externalRefs[systemKey];
}
