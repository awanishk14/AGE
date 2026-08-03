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
