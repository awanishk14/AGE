/**
 * `@age/deployed-origin` — ADR-0061 **A6 item 1**: TLS terminated in front,
 * 🚫 no plaintext origin publicly reachable.
 *
 * ⚠️ **THE FORWARDED HEADER IS BELIEVED ONLY BECAUSE THE SOCKET IS LOOPBACK** —
 * the bind host is checked first, always.
 *
 * 🚫 The composition that arranges this is `deploy/vps/docker-compose.deployed.yml`,
 * a **separate named deployment composition** (ADR-0061 A5), guarded by this
 * package's tests.
 *
 * Pure: no socket, no environment, no name resolution, and no caller.
 */

export {
  acceptForwardedTransport,
  assertOriginNotPubliclyReachable,
  DeployedOriginRefusedError,
  ORIGIN_BIND_HOSTS,
  publicOriginUrlOf,
  type AcceptForwardedTransportInput,
  type OriginBindHost,
  type PublicOriginUrl,
  type RequestTransport,
} from './deployed-origin';
