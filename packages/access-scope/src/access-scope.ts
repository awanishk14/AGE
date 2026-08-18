/**
 * The scope axis — `platform | agency | client` (ADR-0079 §2, slice 1).
 *
 * 🛑 **SCOPE IS NOT A ROLE, AND THE TWO MUST NEVER BE THE SAME FIELD.** A role
 * says what someone does; a scope says how far they can see. Collapsing them
 * produces the one thing this package exists to make impossible: a role string
 * that widens what it can reach, so that renaming somebody's job changes whose
 * data they read.
 *
 * 🛑 **THE PLATFORM SCOPE IS REACHABLE ONLY BY NAME** (ADR-0079 §6 slice 1).
 * `platformScope()` is the sole way to obtain one, and a scope that merely
 * *says* `kind: 'platform'` is REFUSED at runtime rather than believed. That
 * matters because scopes will eventually be built from stored rows, and a stored
 * row is untrusted input: a row reading `platform` must not become platform
 * access by being parsed. Widening to the whole product stays a decision taken
 * in code by someone who typed the name.
 *
 * 🚫 **A CLIENT SCOPE CAN NEVER WIDEN.** It carries the client it speaks for,
 * and there is no arm, flag, wildcard or blank value that means "all clients" —
 * a blank identifier is refused here, at the boundary, so two absences can never
 * agree with each other and be read as an authorization (the
 * `acceptVerifiedSession` reason, unchanged).
 *
 * Pure: no clock, no ids, no randomness, no I/O.
 */

import {
  acceptCapability,
  ROLE_BUNDLES,
  type Capability,
  type RoleBundleName,
} from './capabilities';

/** Raised when something that is not a usable scope is offered as one. */
export class AccessScopeRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccessScopeRefusedError';
  }
}

/**
 * The runtime witness that a platform scope was produced HERE.
 *
 * ⚠️ **IT IS MODULE-PRIVATE AND UNEXPORTED, SO IT CANNOT BE FORGED.** A caller
 * can write `{ kind: 'platform' }`; it cannot write this property, because it
 * has no way to name the symbol.
 */
const PLATFORM_WITNESS = Symbol('@age/access-scope platform scope, produced by platformScope()');

export interface PlatformScope {
  readonly kind: 'platform';
  readonly capabilities: readonly Capability[];
}

export interface AgencyScope {
  readonly kind: 'agency';
  readonly agencyId: string;
  readonly capabilities: readonly Capability[];
}

export interface ClientScope {
  readonly kind: 'client';
  readonly agencyId: string;
  /** The one client this scope speaks for. 🚫 Never blank, 🚫 never a wildcard. */
  readonly clientId: string;
  readonly capabilities: readonly Capability[];
}

export type AccessScope = PlatformScope | AgencyScope | ClientScope;

function acceptIdentifier(field: string, value: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AccessScopeRefusedError(
      `A scope with a blank ${field} is not a scope. An absent identifier compares equal to ` +
        'another absent identifier, so accepting one would let two unknowns agree with each ' +
        'other and be read as an authorization.',
    );
  }

  return value;
}

function capabilitiesOf(bundle: RoleBundleName): readonly Capability[] {
  const granted = ROLE_BUNDLES[bundle];
  if (granted === undefined) {
    throw new AccessScopeRefusedError(
      'That is not a role bundle AGE knows. An unknown bundle is refused rather than treated ' +
        'as an empty one, because an empty capability set is indistinguishable from a mistake.',
    );
  }

  // ⚠️ Re-accepted atom by atom: a bundle is data, and data is checked.
  return Object.freeze(granted.map((capability) => acceptCapability(capability)));
}

/**
 * 🛑 **THE ONLY WAY TO OBTAIN A PLATFORM SCOPE, AND IT TAKES NO ARGUMENTS.**
 *
 * ⚠️ There is deliberately nothing to pass in — no id, no role string, no row.
 * Nothing a request, a form or a database can carry decides whether this is
 * called. 🚫 A guard asserts this function is named in exactly one place outside
 * this package's own tests.
 */
export function platformScope(): PlatformScope {
  const scope = {
    kind: 'platform' as const,
    capabilities: capabilitiesOf('platform-operator'),
  };

  // ⚠️ **NON-ENUMERABLE, AND THAT IS THE WHOLE POINT.** Object spread copies
  // enumerable SYMBOL keys as happily as string ones, so an enumerable witness
  // would survive `{ ...someScope }` — and a scope reassembled field by field
  // out of parts is exactly the shape that arrives from a mapper, a serializer
  // or a row. Defining it non-enumerably means the witness travels with the
  // object this function returned, and with nothing that merely looks like it.
  Object.defineProperty(scope, PLATFORM_WITNESS, {
    value: true,
    enumerable: false,
    writable: false,
    configurable: false,
  });

  return Object.freeze(scope) as PlatformScope;
}

/** An agency scope. It sees its own agency and the clients beneath it, and no other agency. */
export function agencyScope(agencyId: string): AgencyScope {
  return Object.freeze({
    kind: 'agency' as const,
    agencyId: acceptIdentifier('agencyId', agencyId),
    capabilities: capabilitiesOf('agency-operator'),
  });
}

/**
 * A client scope: one client, beneath one agency, read-only (ADR-0079 §0.2).
 *
 * ⚠️ **THE AGENCY IS CARRIED, 🚫 NOT INFERRED FROM THE CLIENT.** Which agency a
 * client belongs to is a fact held by a registry, and inferring it here would
 * make this module the second place that answers it.
 */
export function clientScope(agencyId: string, clientId: string): ClientScope {
  return Object.freeze({
    kind: 'client' as const,
    agencyId: acceptIdentifier('agencyId', agencyId),
    clientId: acceptIdentifier('clientId', clientId),
    capabilities: capabilitiesOf('client-viewer'),
  });
}

/**
 * Re-accepts a scope at the point of USE.
 *
 * 🛑 **A HAND-BUILT `{ kind: 'platform' }` IS REFUSED HERE.** This is the check
 * that makes "reachable only by name" true at runtime and not merely in the type
 * system, where a cast would end it.
 *
 * @throws {AccessScopeRefusedError} naming the POSITION, 🚫 never an identifier.
 */
export function acceptAccessScope(scope: AccessScope): AccessScope {
  switch (scope.kind) {
    case 'platform': {
      const witnessed = (scope as unknown as Record<symbol, unknown>)[PLATFORM_WITNESS] === true;
      if (!witnessed) {
        throw new AccessScopeRefusedError(
          'Refused: that value claims platform scope but was not produced by platformScope(). ' +
            'Platform-wide access is reached by naming it in code, never by a value that says ' +
            'so — a stored row is untrusted input, and parsing one must not widen anybody.',
        );
      }
      return scope;
    }
    case 'agency':
      acceptIdentifier('agencyId', scope.agencyId);
      return scope;
    case 'client':
      acceptIdentifier('agencyId', scope.agencyId);
      acceptIdentifier('clientId', scope.clientId);
      return scope;
  }
}
