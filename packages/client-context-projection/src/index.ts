/**
 * `@age/client-context-projection` — ADR-0069 deliverable 7, the projection.
 *
 * 🛑 **THE TOOL THAT SERVES THIS IS 🚫 NOT IN THIS PACKAGE, AND 🚫 NOT YET
 * BUILT.** Deliverable 7 says "entitled on read", and the only `Authentication`
 * anyone can construct today is `none` (`@age/entitlement`) — so an MCP tool
 * wired through `readWithinEntitlement` would refuse every call. The projection
 * ships first, on its own, and the surface waits for token verification
 * (ADR-0068 §0.1b, still owed). 🚫 Do not close that gap by inventing a session,
 * defaulting an organization or skipping the entitlement question.
 *
 * 🚫 **NOTHING HERE READS, WRITES OR TRANSPORTS.** It is a pure function over a
 * context the caller already holds. ADR-0066 D7 is untouched: this accepts
 * nothing inbound because it accepts nothing at all.
 */

export {
  AGE_PEER_CONTRACT,
  PEER_CONTEXT_DOCUMENT,
  asPeerContextDocument,
  type PeerContextDocument,
  type PeerObservationDocument,
} from './peer-contract';

export {
  projectClientContext,
  type ClientContextProjection,
  type ClientContextProjectionInput,
  type ProjectedSubjectKind,
  type ProjectedSubjectKindState,
} from './projection';
