/**
 * ADR-0061 **A5** — the database rule, deliberately revisited.
 *
 * 🛑 **THE CONSEQUENCE BEFORE THE MECHANISM: a real client's data will live on a
 * server the operator does not physically hold.** That is precisely what
 * ADR-0055 D6 refused. It is a genuine reduction in safety, the Product Owner
 * made the call knowing the product carries their clients' data, and 🚫 nothing
 * in this module may be read as saying otherwise. This code is **honest about
 * being remote** — that honesty is the whole design.
 *
 * WHAT IT DECIDES. The deployed database is the VPS's own Postgres, reachable
 * only over the VPS's **loopback or a private interface**, 🚫 never exposed
 * publicly.
 *
 * 🛑 **NOT A FLAG, NOT AN `allowRemote` PARAMETER, NOT A QUIETLY-PERMITTING
 * SECOND FUNCTION** (ADR-0061 §2 Q5 refuses all three by name, because _"the copy
 * that gets relaxed still passes its own tests"_). It is a **separate named
 * deployment composition** in a separate package: its identity is in its name,
 * and 🚫 it cannot be selected by an environment variable alone — the selector
 * takes an acknowledgement whose type no `string | undefined` read out of an
 * environment can satisfy.
 *
 * ⚠️ **`assertLocalDatabaseTarget` KEEPS ITS TEETH and is NOT this code path.**
 * `apps/capture`'s local rule is 🚫 not deleted, 🚫 not relaxed and 🚫 not
 * imported here — it says the target is on the operator's own machine, which is
 * a claim this module deliberately does **not** make. ⚠️ Its named evasion still
 * stands, and applies here too: an SSH tunnel from `localhost:5432` to a shared
 * server _is_ loopback. A private address is 🚫 **NOT PROOF** of anything; it
 * refuses the cases it can see, which is strictly better than refusing none.
 *
 * 🚫 **THIS IS NOT AN AUTHORIZATION.** Where a row may be stored is not who may
 * read it (A2/A3, `askEntitlement`), and 🚫 RLS is coherence, not authorization
 * (ADR-0046 D5).
 *
 * PURE. It decides about a STRING. It opens no connection, reads no environment,
 * and resolves no name — a DNS lookup here would be both an effect and a lie,
 * since a name that resolves to a private address today may not tomorrow. That
 * is why a host **name** is refused outright rather than looked up.
 *
 * ⚠️ NO CREDENTIAL IS EVER RETURNED IN AN ERROR. A connection string carries a
 * password, so a refusal names the HOST it rejected and nothing else.
 */

/** Refusal raised when a connection string may not be a deployed target. */
export class DeployedDatabaseTargetRefusedError extends Error {
  /** The rejected host. 🚫 Never the URL — that carries the password. */
  readonly host: string;

  constructor(message: string, host: string) {
    super(message);
    this.name = 'DeployedDatabaseTargetRefusedError';
    this.host = host;
  }
}

/**
 * A connection string that has passed A5's rule.
 *
 * ⚠️ Branded, one direction only: a plain `string` cannot be passed where one of
 * these is required, so a deployment composition cannot be handed a URL that was
 * never judged. 🚫 There is deliberately no way back to a `DeployedDatabaseUrl`
 * from a cast that lives outside this module.
 */
export type DeployedDatabaseUrl = string & {
  readonly __deployedDatabaseTarget: unique symbol;
};

/**
 * The one composition this package names. 🚫 It is not a mode of the local one.
 */
export const DEPLOYED_DATABASE_COMPOSITION_NAME = 'age-deployed-vps-postgres';

/**
 * ⚠️ **THE ACKNOWLEDGEMENT IS THE POINT, NOT CEREMONY.** Its type is a single
 * string literal, so a value read from an environment — which is
 * `string | undefined` — cannot reach this argument without a caller writing the
 * sentence out in source. That is what makes "🚫 cannot be selected by an
 * environment variable alone" a compile error rather than a paragraph.
 */
export const REMOTE_ACKNOWLEDGEMENT = 'this-database-is-not-on-the-operators-machine';

export type RemoteAcknowledgement = typeof REMOTE_ACKNOWLEDGEMENT;

/** What a deployment composition is handed once the target has been judged. */
export interface DeployedDatabaseComposition {
  /** 🚫 Never 'local'. The identity is explicit in the value, not inferred. */
  readonly compositionName: typeof DEPLOYED_DATABASE_COMPOSITION_NAME;
  /** The judged connection string. */
  readonly url: DeployedDatabaseUrl;
  /**
   * How the host qualified. ⚠️ Recorded so an operator can see WHICH rule let the
   * target through; 🚫 it is never a claim that the database is the operator's.
   */
  readonly reachability: 'vps-loopback' | 'private-interface';
}

/** Hosts that are the server the process is running on. */
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '::1', '0:0:0:0:0:0:0:1']);

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/**
 * The host a PostgreSQL connection string addresses, or `undefined` when the
 * string is not one this code is willing to reason about.
 *
 * ⚠️ Unparseable is 🚫 not "probably fine". Every path that cannot establish the
 * host returns `undefined`, and the caller refuses — the fail-closed direction.
 */
export function deployedDatabaseTargetHost(url: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    return undefined;
  }

  // A URL-encoded unix socket directory arrives as a query parameter with an
  // empty hostname. That may well be the VPS's own socket, but it is a case this
  // code has never been exercised against, so it is refused rather than guessed
  // at (the same decision the local rule made).
  // ⚠️ An IPv6 host arrives bracketed (`[::1]`). The brackets are URL syntax, not
  // part of the address, and leaving them on would make every IPv6 address fail
  // to match — a rule that silently never fires.
  const hostname = parsed.hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');

  return hostname.length === 0 ? undefined : hostname;
}

type Reachability = DeployedDatabaseComposition['reachability'];

/**
 * ⚠️ **AN ALLOW-LIST, 🚫 NEVER A DENY-LIST.** Naming the public ranges to reject
 * leaves every range nobody thought of — and "not obviously public" is exactly
 * the reasoning that puts a client's rows on the internet. What is permitted is
 * stated instead.
 *
 * 🚫 Link-local (`169.254.*`, `fe80::`) and carrier-grade NAT (`100.64/10`) are
 * **not** permitted: they are not a deliberately configured private interface,
 * and one of them is the cloud metadata range.
 */
function reachabilityOf(host: string): Reachability | undefined {
  if (LOOPBACK_HOSTS.has(host)) return 'vps-loopback';

  const ipv4 = IPV4.exec(host);
  if (ipv4) {
    const octets = ipv4.slice(1).map((part) => Number.parseInt(part, 10));
    if (octets.some((octet) => octet > 255)) return undefined;
    const [first, second] = octets as [number, number, number, number];

    if (first === 127) return 'vps-loopback';
    if (first === 10) return 'private-interface';
    if (first === 172 && second >= 16 && second <= 31) return 'private-interface';
    if (first === 192 && second === 168) return 'private-interface';
    return undefined;
  }

  // IPv6 unique local addresses (fc00::/7). Anything else — including every
  // host NAME, which would have to be resolved to judge, and resolving is an
  // effect this module refuses to perform — falls through to a refusal.
  if (/^f[cd][0-9a-f]{0,2}:/.test(host)) return 'private-interface';

  return undefined;
}

/**
 * Refuses a connection string that is not a permitted deployed target.
 *
 * @throws {DeployedDatabaseTargetRefusedError} for a publicly reachable host, a
 *         host name that would have to be resolved, and any connection string
 *         whose host cannot be established at all.
 */
export function assertDeployedDatabaseTarget(url: string): DeployedDatabaseUrl {
  return judgeDeployedDatabaseTarget(url).url;
}

/** The single judgement. Both public entry points go through it, once. */
function judgeDeployedDatabaseTarget(url: string): {
  readonly url: DeployedDatabaseUrl;
  readonly reachability: Reachability;
} {
  const host = deployedDatabaseTargetHost(url);

  if (host === undefined) {
    throw new DeployedDatabaseTargetRefusedError(
      'The database target could not be read as a PostgreSQL connection string, so it cannot be ' +
        'shown to be unreachable from outside the server. ADR-0061 A5 permits the deployed ' +
        "database only over the server's own loopback or a private interface, so this run is " +
        'refused rather than attempted.',
      '(unreadable)',
    );
  }

  const reachability = reachabilityOf(host);

  if (reachability === undefined) {
    throw new DeployedDatabaseTargetRefusedError(
      `The database target host is "${host}", which is not the server's loopback and not a ` +
        'private address. ADR-0061 A5 permits the deployed database only over the ' +
        "server's own loopback or a private interface, and never a publicly exposed one. A host " +
        'name is refused for the same reason: judging it would mean resolving it, and a name ' +
        'that resolves privately today may not tomorrow. Give the address itself.',
      host,
    );
  }

  // ⚠️ The ONE cast into the branded type, in the module that owns the rule. A
  // second copy anywhere else would be a way to skip the judgement above.
  return { url: url as DeployedDatabaseUrl, reachability };
}

export interface SelectDeployedDatabaseCompositionOptions {
  /** The connection string. Judged here; 🚫 never trusted because it was configured. */
  readonly url: string;
  /**
   * 🛑 Written out in source by whoever chose the deployed composition.
   *
   * ⚠️ Its literal type is what stops an environment variable selecting this path
   * on its own, and its wording is what stops the choice being made without
   * reading what it costs: the operator no longer holds the machine.
   */
  readonly acknowledgedRemote: RemoteAcknowledgement;
}

/**
 * The **separate named deployment composition**'s entry point (ADR-0061 A5).
 *
 * 🚫 There is no counterpart parameter that turns this into the local path, and
 * 🚫 no parameter that turns the local path into this one. Two names, two code
 * paths, and the one that permits a remote server says so in its own name.
 *
 * @throws {DeployedDatabaseTargetRefusedError} as `assertDeployedDatabaseTarget`,
 *         and if the acknowledgement is absent at runtime.
 */
export function selectDeployedDatabaseComposition(
  options: SelectDeployedDatabaseCompositionOptions,
): DeployedDatabaseComposition {
  // ⚠️ Checked at runtime as well as in the type. The type stops a `string` from
  // an environment; this stops a caller that reached here through `any`, a cast,
  // or plain JavaScript — the routes a compile-time-only rule does not cover.
  if (options.acknowledgedRemote !== REMOTE_ACKNOWLEDGEMENT) {
    throw new DeployedDatabaseTargetRefusedError(
      'The deployed database composition was selected without its acknowledgement. This ' +
        "composition puts a real client's data on a server the operator does not physically " +
        'hold; that choice is made in source, deliberately, and never by configuration alone.',
      '(not judged)',
    );
  }

  const judged = judgeDeployedDatabaseTarget(options.url);

  return {
    compositionName: DEPLOYED_DATABASE_COMPOSITION_NAME,
    url: judged.url,
    reachability: judged.reachability,
  };
}
