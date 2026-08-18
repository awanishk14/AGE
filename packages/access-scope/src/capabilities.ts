/**
 * Capability atoms and role bundles — ADR-0079 §2, slice 1 of §6.
 *
 * 🛑 **AN ATOM IS WHAT SOMEONE MAY DO; A BUNDLE IS ONLY A NAME FOR A SET OF
 * ATOMS.** Every decision in this package is taken against an ATOM. A bundle is
 * never consulted at decision time, because the moment a decision reads a role
 * name, "is this person an admin" becomes answerable — and ADR-0062 D3 (admin is
 * never a bypass) is unenforceable from that point on.
 *
 * ⚠️ The shape is adopted from the peer product's authz module, which was READ
 * and 🚫 never modified (ADR-0079 §2). What is adopted is the SEPARATION —
 * atoms, bundles, and a scope axis that is not a role — 🚫 not its vocabulary,
 * which names work AGE does not do.
 *
 * 🚫 **NO ATOM HERE ISSUES, MINTS OR PROVISIONS ANYTHING.** `account.provision`
 * is the right to ASK for provisioning, which remains a human act performed out
 * of band; naming the atom does not build the path, and slice 2 is where any
 * path would have to be authorized.
 *
 * Pure: no clock, no ids, no randomness, no I/O.
 */

/** Raised when something that is not a capability is offered as one. */
export class CapabilityRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CapabilityRefusedError';
  }
}

/**
 * Every capability AGE can decide about.
 *
 * ⚠️ **THE LIST IS EXHAUSTIVE ON PURPOSE.** A capability that is not here cannot
 * be asked about, so a new surface cannot quietly grant itself something by
 * inventing a permission string at the call site.
 */
export const CAPABILITY_ATOMS = [
  'snapshot.read',
  'snapshot.capture',
  'snapshot.score',
  'client.read',
  'client.create',
  'agency.read',
  'agency.create',
  'account.read',
  'account.provision',
  'session.revoke',
  'rendering.candid',
  'rendering.client',
] as const;

export type Capability = (typeof CAPABILITY_ATOMS)[number];

const ATOMS: ReadonlySet<string> = new Set<string>(CAPABILITY_ATOMS);

/**
 * Atoms that only ever READ. ⚠️ A rendering is a read: choosing which of the two
 * renderings (ADR-0079 §4) someone may see decides what is shown, 🚫 never what
 * is stored.
 */
export const READING_ATOMS: readonly Capability[] = Object.freeze([
  'snapshot.read',
  'client.read',
  'agency.read',
  'account.read',
  'rendering.candid',
  'rendering.client',
]);

/**
 * Atoms that change stored state, or ask a human to.
 *
 * 🛑 **THIS PARTITION IS LOAD-BEARING AND A GUARD PROVES IT TOTAL.** The
 * client-read-only rule (ADR-0079 §5) is expressed as "the client bundle
 * contains no writing atom", which is only a rule if every atom is classified.
 * An unclassified atom would be neither reading nor writing, and would slip
 * through that check unexamined.
 */
export const WRITING_ATOMS: readonly Capability[] = Object.freeze([
  'snapshot.capture',
  'snapshot.score',
  'client.create',
  'agency.create',
  'account.provision',
  'session.revoke',
]);

/**
 * The bundles, by name.
 *
 * ⚠️ **A BUNDLE IS A CONVENIENCE FOR HUMANS ASSIGNING ACCESS**, and nothing
 * else. `decideAccess` never sees one: it is handed a scope, which already
 * carries the atoms resolved from a bundle.
 */
export type RoleBundleName = 'platform-operator' | 'agency-operator' | 'client-viewer';

/**
 * 🛑 **THE CLIENT BUNDLE IS THE OWNER'S DECISION, VERBATIM: "clients
 * read-only"** (ADR-0079 §0.2, §5). 🚫 It contains no writing atom and 🚫 not
 * `rendering.candid` — a client seeing the candid rendering is the failure mode
 * §4 exists to prevent, and it would be a product failure long before it was a
 * security one.
 *
 * 🚫 **DO NOT ADD AN ATOM HERE TO MAKE A SCREEN WORK.** The screen is wrong, or
 * the owner has changed the rule and an ADR says so.
 */
export const ROLE_BUNDLES: Readonly<Record<RoleBundleName, readonly Capability[]>> = Object.freeze({
  'platform-operator': Object.freeze([...CAPABILITY_ATOMS]),
  'agency-operator': Object.freeze([
    'snapshot.read',
    'snapshot.capture',
    'snapshot.score',
    'client.read',
    'client.create',
    'agency.read',
    'account.read',
    'session.revoke',
    'rendering.candid',
    'rendering.client',
  ] as const),
  'client-viewer': Object.freeze(['snapshot.read', 'rendering.client'] as const),
});

/**
 * Accepts a capability, refusing anything that is not one.
 *
 * @throws {CapabilityRefusedError} naming the POSITION and 🚫 never echoing the
 *         offered value, which came from outside and may be anything at all.
 */
export function acceptCapability(capability: string): Capability {
  if (!ATOMS.has(capability)) {
    throw new CapabilityRefusedError(
      'That is not a capability AGE decides about. An unknown capability is refused rather ' +
        'than denied: AGE has no rule for it, and inventing one at the call site is how a ' +
        'surface grants itself access.',
    );
  }

  return capability as Capability;
}
