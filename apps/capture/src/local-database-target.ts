/**
 * Is this connection a LOCAL database the operator controls? (ADR-0054 D6
 * condition 2.)
 *
 * WHAT D6 ACTUALLY PERMITS. ADR-0046 D7 forbids `produceAndCapture` against any
 * durable database. ADR-0054 D6 relaxes that in exactly one narrow case, and
 * condition 2 is the one clause a machine can check: _"The target is a local
 * development database the operator controls. 🚫 Not production, not shared, not
 * any database another tenant's data has ever touched."_
 *
 * ⚠️ A CONDITION STATED IN AN ADR AND NOWHERE ELSE IS A CONDITION THAT HOLDS
 * UNTIL THE FIRST TIRED EVENING. The other four conditions are structural — the
 * scope comes from a loaded record because there is no other way to obtain one,
 * `produceOnly` is the default because no flag defaults to writing, and nothing
 * here schedules anything because nothing here has a scheduler. Condition 2 is
 * the only one that would otherwise rest on the operator's memory of which
 * connection string is currently exported.
 *
 * WHAT THIS CAN AND CANNOT CLAIM. A loopback host is a NECESSARY condition, not
 * a sufficient one: an SSH tunnel from `localhost:5432` to a shared server is
 * loopback and is exactly what D6 forbids. 🚫 This must never be described as
 * proving the target is the operator's own database. It refuses the cases it can
 * see, which is strictly better than refusing none, and the operator remains
 * responsible for the rest.
 *
 * PURE. It decides about a STRING. It opens no connection, resolves no name and
 * reads no environment — a DNS lookup here would be both an effect and a lie,
 * since a name that resolves to loopback today may not tomorrow.
 *
 * ⚠️ NO CREDENTIAL IS EVER RETURNED IN AN ERROR. A connection string carries a
 * password, so the refusal names the HOST it rejected and nothing else.
 */

/** Hosts that are the machine the CLI is running on. Nothing else is accepted. */
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set([
  'localhost',
  '127.0.0.1',
  '[::1]',
  '::1',
  '[0:0:0:0:0:0:0:1]',
]);

export class NonLocalDatabaseTargetError extends Error {
  /** The rejected host. Never the URL — that carries the password. */
  readonly host: string;

  constructor(message: string, host: string) {
    super(message);
    this.name = 'NonLocalDatabaseTargetError';
    this.host = host;
  }
}

/**
 * The host a PostgreSQL connection string addresses, or `undefined` when the
 * string is not one this code is willing to reason about.
 *
 * ⚠️ Unparseable is not "probably fine". Every path that cannot establish the
 * host returns `undefined`, and the caller refuses — the fail-closed direction.
 */
export function databaseTargetHost(url: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    return undefined;
  }

  // A URL-encoded unix socket directory (`host=/var/run/postgresql`) arrives as
  // a query parameter with an empty hostname. That IS local, but it is also a
  // case this code has never been exercised against, so it is refused rather
  // than guessed at.
  const hostname = parsed.hostname.trim().toLowerCase();

  return hostname.length === 0 ? undefined : hostname;
}

/**
 * Refuses a connection that is not demonstrably on this machine.
 *
 * @throws {NonLocalDatabaseTargetError} for any host that is not loopback, and
 *         for any connection string whose host cannot be established at all.
 */
export function assertLocalDatabaseTarget(url: string): void {
  const host = databaseTargetHost(url);

  if (host === undefined) {
    throw new NonLocalDatabaseTargetError(
      'The database target could not be read as a PostgreSQL connection string, so it cannot be ' +
        'shown to be local. ADR-0054 D6 permits a write only to a local development database the ' +
        'operator controls, so this run is refused rather than attempted.',
      '(unreadable)',
    );
  }

  if (!LOOPBACK_HOSTS.has(host)) {
    throw new NonLocalDatabaseTargetError(
      `The database target host is "${host}", which is not this machine. ADR-0054 D6 permits a ` +
        'write only to a local development database the operator controls — not production, not ' +
        'shared, and not any database another tenant’s data has ever touched. Point ' +
        'DATABASE_URL_APP at a local database, or run without --capture.',
      host,
    );
  }
}
