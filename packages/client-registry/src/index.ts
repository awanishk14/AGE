/**
 * @age/client-registry — who the business is, and who acted (ADR-0053).
 *
 * A pure lookup, not a loader. It performs no I/O, reads no clock, and reaches
 * no external system. It exists so that a real business can be NAMED inside
 * AGE, replacing the single frozen `demoContext` every reachable surface has
 * passed since the demo track began.
 *
 * ⚠️ Naming is not reachability. This package does not make AGE reachable for a
 * real client; it makes a real client nameable. Conflating those two is the
 * ADR-0050 §3 failure this track has already been caught by once.
 */

export {
  clientRecordSchema,
  externalRefsSchema,
  findClientRecord,
  findExternalRef,
  parseClientRecord,
  toClientContext,
  type ClientRecord,
} from './client-record';

export {
  isOperatorPrincipal,
  operatorPrincipal,
  parseOperatorPrincipal,
  OPERATOR_PRINCIPAL_PREFIX,
  type OperatorPrincipal,
} from './operator-principal';

export { FICTIONAL_CLIENT_RECORDS, FICTIONAL_MARKER } from './fixtures/fictional-clients';
