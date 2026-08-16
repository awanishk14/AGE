/**
 * OX-INV-1 (ADR-0057 D2): the console binds to loopback, or it refuses to start.
 *
 * ⚠️ THE CLAIM IS BOUNDED, AND THE BOUND IS STATED WHEREVER THE GUARD IS
 * DESCRIBED. Loopback is NECESSARY, NOT SUFFICIENT. A reverse proxy, an SSH
 * tunnel, or a published container port in front of a loopback listener defeats
 * it completely. This must NEVER be described as proving the console is
 * unreachable. It refuses the cases it can see, which is strictly better than
 * refusing none, and the operator remains responsible for the rest — the
 * identical honesty `assertLocalDatabaseTarget` already carries.
 *
 * 🚫 There is no flag, no environment override and no `allowRemote` option, for
 * the same reason `openLocalPrismaCaptureConnection` is a separate function
 * rather than a boolean on the general one: the copy that gets relaxed still
 * passes its own tests.
 *
 * 🚫 A non-loopback host is a STARTUP REFUSAL — not a warning, not a log line,
 * not a degraded mode that binds loopback anyway. Silently substituting a safe
 * host would leave the operator believing a configuration took effect when it
 * did not, which is the class of error this repository refuses everywhere else.
 */

/** The host the console binds when nothing is configured. */
export const DEFAULT_STUDIO_BIND_HOST = '127.0.0.1' as const;

/**
 * The hosts accepted as loopback.
 *
 * Deliberately an exact-match list rather than a pattern. `127.0.0.0/8` is
 * entirely loopback on Linux, but accepting the whole range by regex invites a
 * later "surely `127.x` is fine" relaxation of the regex itself, and the range's
 * behaviour is not uniform across platforms. An operator who needs a different
 * loopback address is a decision, not a configuration.
 *
 * 🚫 `localhost` is NOT on this list. It is a NAME, resolved by the host's
 * resolver, and what it resolves to is not knowable here — `/etc/hosts` can map
 * it anywhere. Accepting a name would mean this function reports a fact about
 * an address it never saw.
 */
const LOOPBACK_HOSTS: readonly string[] = ['127.0.0.1', '::1'];

export class StudioBindRefusedError extends Error {
  public override readonly name = 'StudioBindRefusedError';

  public constructor(message: string) {
    super(message);
  }
}

/**
 * Returns the host if it is loopback; throws `StudioBindRefusedError` otherwise.
 *
 * The refusal names the offending host, because the operator configured it and
 * needs to see which value was rejected. 🚫 It carries nothing else — no
 * environment dump, no resolved paths, no other configuration values.
 */
export function assertLoopbackBindHost(host: string): string {
  if (typeof host !== 'string' || host.trim() === '') {
    throw new StudioBindRefusedError(
      'AGE Studio refuses to start: no bind host was configured. ' +
        `Expected one of ${LOOPBACK_HOSTS.join(', ')}.`,
    );
  }

  const normalized = host.trim();

  if (!LOOPBACK_HOSTS.includes(normalized)) {
    throw new StudioBindRefusedError(
      `AGE Studio refuses to start: the configured bind host ${JSON.stringify(normalized)} is not ` +
        `loopback. Expected one of ${LOOPBACK_HOSTS.join(', ')}. ` +
        'There is no override — AGE Studio is a single-operator local surface (ADR-0057 D2). ' +
        'Note that binding loopback is necessary, not sufficient: a proxy, tunnel or published ' +
        'container port in front of this listener defeats it.',
    );
  }

  return normalized;
}

/** The hosts this policy accepts, exposed so a caller can state them honestly. */
export function loopbackHosts(): readonly string[] {
  return LOOPBACK_HOSTS;
}

/**
 * OX-INV-1 AS AMENDED BY ADR-0076 D2, WITH D3 AS AMENDED BY THAT ADR'S §0.4b.
 *
 * 🛑 **THE RULE DID NOT WEAKEN; ITS SUBJECT BECAME EXPLICIT.** The invariant was
 * never about the string `127.0.0.1` — it was about the console's listener not
 * being reachable from the network. `assertLoopbackBindHost` above expresses
 * that for a process on a host. A container expresses the SAME boundary
 * differently: the listener binds every address of its own namespace, and the
 * deployment publishes it on host loopback and nowhere else.
 *
 * ⚠️ **WHY `0.0.0.0` IS ACCEPTED HERE AND NOWHERE ELSE.** Inside a namespace it
 * means "every address of THIS container", which is one interface nothing else
 * shares. What decides who can reach it is the PUBLICATION, not the bind — and
 * `127.0.0.1:3100:3100` in the compose file confines that to host loopback,
 * exactly the boundary ADR-0057 D2 has always required.
 *
 * 🛑 **SO THE ONE LINE THAT MATTERS IS NOT IN THIS FILE**, and pretending
 * otherwise is how this gets undone: `3100:3100` publishes on every interface,
 * including the public one, and this function would still return `0.0.0.0`
 * happily. ⚠️ A guard in
 * `packages/deployed-origin/src/tests/studio-service-sandbox.spec.ts` asserts
 * the exact published mapping for that reason.
 *
 * ⚠️ **AN EARLIER DRAFT OF THIS COMMENT CLAIMED THE CONTAINER PUBLISHED NOTHING
 * AND WAS THEREFORE "STRICTLY STRONGER" THAN A HOST BIND. 🚫 THAT WAS MEASURED
 * FALSE** — the host's nginx already owns 80/443 for five peer vhosts, so an
 * AGE-owned edge proxy could not exist, and every alternative reaches the
 * console from host loopback anyway (ADR-0076 §0.4b). The reachability the
 * container DOES remove is OUTBOUND: 🛑 the console can no longer open SNARA's
 * loopback-published postgres and redis, which is the violation D1 was for.
 *
 * 🚫 **THE BOUNDARY IS AN ARGUMENT, NOT AN ENVIRONMENT VARIABLE.** It is passed
 * in by the caller and there are exactly two values. A `process.env` read here
 * would let a misconfigured host silently select the permissive branch — the
 * class of error `assertLoopbackBindHost` refuses by having no override.
 */
export type ConsoleListenerBoundary = 'host-loopback' | 'loopback-published-container';

/** The address a container-mode console binds — every address of ITS OWN namespace. */
const CONTAINER_NAMESPACE_HOST = '0.0.0.0' as const;

export function assertConsoleBindHost(host: string, boundary: ConsoleListenerBoundary): string {
  if (boundary === 'host-loopback') {
    return assertLoopbackBindHost(host);
  }

  const normalized = typeof host === 'string' ? host.trim() : '';

  if (normalized !== CONTAINER_NAMESPACE_HOST) {
    throw new StudioBindRefusedError(
      `AGE Studio refuses to start: inside its container the bind host must be ` +
        `${CONTAINER_NAMESPACE_HOST}, not ${JSON.stringify(normalized)}. ` +
        'Binding loopback inside a container would make the console unreachable through its own ' +
        'published port, and the deployment would answer with a connection refused it could not ' +
        'explain (ADR-0076 D2/D3). Note that this mode is sound ONLY while that publication is ' +
        'confined to 127.0.0.1; publishing on every interface defeats the invariant.',
    );
  }

  return normalized;
}
