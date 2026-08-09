/**
 * ADR-0061 **A6 item 1** — transport.
 *
 * 🛑 **TLS IS TERMINATED IN FRONT OF THE APP, AND 🚫 NO PLAINTEXT ORIGIN IS
 * PUBLICLY REACHABLE.** Those are two rules, not one, and the second is the one
 * that gets lost: a deployment can serve `https://` to the world and still
 * publish the application's own plaintext port on the same host, at which point
 * the certificate decorates a door that nobody has to use.
 *
 * ⚠️ **THE FORWARDED HEADER IS NOT EVIDENCE OF ANYTHING BY ITSELF.**
 * `X-Forwarded-Proto: https` is a string any client can send. It is worth
 * something only because the request arrived on a socket that only the
 * terminator on this host can reach — so this module refuses to read the header
 * at all unless the origin is bound to loopback. 🚫 Trusting the header on a
 * publicly-bound origin is the exact failure this item exists to prevent.
 *
 * PURE. It decides about strings. 🚫 It opens no socket, reads no environment,
 * resolves no name and terminates nothing.
 *
 * 🚫 **THIS IS NOT AN AUTHORIZATION.** How a request arrived is not who may read
 * a row (A2/A3, `askEntitlement`).
 *
 * ⚠️ **A REFUSAL NAMES A POSITION, NEVER A VALUE.** A URL can carry a token in
 * its query and a credential in its authority, so no candidate is ever echoed.
 */

/** Refusal raised when a transport arrangement may not be deployed or trusted. */
export class DeployedOriginRefusedError extends Error {
  /** The position refused — a field name. 🚫 Never the value it held. */
  readonly subject: string;

  constructor(message: string, subject: string) {
    super(message);
    this.name = 'DeployedOriginRefusedError';
    this.subject = subject;
  }
}

declare const PUBLIC_ORIGIN: unique symbol;

/**
 * A public origin that has passed A6 item 1's rule.
 *
 * ⚠️ Branded, one direction only: a plain `string` cannot be passed where one of
 * these is required, so a composition cannot be handed a URL that was never
 * checked. 🚫 There is no way back to one but `publicOriginUrlOf`.
 */
export type PublicOriginUrl = string & { readonly [PUBLIC_ORIGIN]: true };

function refuse(message: string, subject: string): never {
  throw new DeployedOriginRefusedError(message, subject);
}

/**
 * The one door the world may knock on.
 *
 * 🚫 `http:` is refused outright — there is no "redirects to https anyway" arm,
 * because the first request already crossed the network in the clear.
 */
export function publicOriginUrlOf(candidate: string): PublicOriginUrl {
  if (candidate.trim() === '') {
    refuse(
      'Refused: the public origin is blank. A deployment without a stated origin ' +
        'has no transport rule to keep.',
      'publicOrigin',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate.trim());
  } catch {
    refuse(
      'Refused: the public origin is not a URL. It is refused rather than repaired, ' +
        'because guessing a scheme is how a plaintext origin gets deployed.',
      'publicOrigin',
    );
  }

  if (parsed.protocol !== 'https:') {
    refuse(
      'Refused: the public origin does not use https. TLS is terminated in front of ' +
        'the app, so any other scheme means the world reaches it in the clear.',
      'publicOrigin.protocol',
    );
  }

  if (parsed.username !== '' || parsed.password !== '') {
    refuse(
      'Refused: the public origin carries a credential in its authority. An origin is ' +
        'printed, logged and pasted; a credential inside one leaks by being ordinary.',
      'publicOrigin.credentials',
    );
  }

  if (parsed.hostname.trim() === '') {
    refuse('Refused: the public origin names no host.', 'publicOrigin.hostname');
  }

  if (parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '') {
    refuse(
      'Refused: an origin is a scheme, a host and a port — nothing more. A path, query ' +
        'or fragment here would be silently dropped by everything that consumes it.',
      'publicOrigin.path',
    );
  }

  // ⚠️ `origin` is scheme, host and port and nothing else — the same narrowing
  // stated once by the platform rather than reassembled here.
  return parsed.origin as PublicOriginUrl;
}

/**
 * The only hosts the application's own listener may bind to.
 *
 * ⚠️ **AN ALLOW-LIST.** 🚫 A deny-list of `0.0.0.0` and `::` leaves every
 * specific public address of the machine, which is the same mistake spelled
 * more confidently.
 */
export const ORIGIN_BIND_HOSTS = Object.freeze(['127.0.0.1', '::1'] as const);

/** A bind host that has passed the rule. */
export type OriginBindHost = (typeof ORIGIN_BIND_HOSTS)[number];

/**
 * 🛑 The app itself is never publicly reachable. Only the terminator is.
 */
export function assertOriginNotPubliclyReachable(bindHost: string): OriginBindHost {
  const offered = bindHost.trim();

  const allowed = ORIGIN_BIND_HOSTS.find((host) => host === offered);
  if (allowed === undefined) {
    refuse(
      'Refused: the application would listen somewhere other than this host’s loopback. ' +
        'TLS in front only means anything while the plaintext listener behind it cannot ' +
        'be reached from off the machine.',
      'bindHost',
    );
  }

  return allowed;
}

/** How a request reached the application, once it is worth believing. */
export type RequestTransport = 'https';

export interface AcceptForwardedTransportInput {
  /** Where the application's own listener is bound. */
  readonly bindHost: string;
  /** The `X-Forwarded-Proto` value as received, or `null` when absent. */
  readonly forwardedProto: string | null;
}

/**
 * ⚠️ The order here is load-bearing: **the bind host is checked first**, and the
 * header is never read on a publicly-bound origin. 🚫 Reading the header first
 * and the bind host second would still pass every test written about the header.
 */
export function acceptForwardedTransport(input: AcceptForwardedTransportInput): RequestTransport {
  assertOriginNotPubliclyReachable(input.bindHost);

  if (input.forwardedProto === null) {
    refuse(
      'Refused: nothing in front of the app said how the request arrived. Absent is not ' +
        'https — an unterminated request looks exactly like this.',
      'forwardedProto',
    );
  }

  const offered = input.forwardedProto.trim().toLowerCase();

  if (offered.includes(',')) {
    refuse(
      'Refused: more than one forwarded protocol was offered, so at least one hop is ' +
        'unaccounted for. 🚫 Taking the first value would let a client prepend its own.',
      'forwardedProto',
    );
  }

  if (offered !== 'https') {
    refuse(
      'Refused: the request reached the terminator in the clear. It is refused rather ' +
        'than redirected, because whatever it carried has already crossed the network.',
      'forwardedProto',
    );
  }

  return 'https';
}
