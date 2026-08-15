import { projectClientContext, type ClientContextProjection } from '@age/client-context-projection';

import type { OpenSnapshotRead, SnapshotReadPort } from './stored-snapshot';
import type { OperatorWorkspaceRuntime } from './operator-workspace-runtime';
import { resolveBusinessScope } from './operator-workspace';

/**
 * Reading WHAT AGE WOULD TELL A PEER about a business (ADR-0069 deliverable 7).
 *
 * 🛑 **THE OPERATOR SEES THE PEER'S ANSWER, NOT A DESCRIPTION OF IT.** This
 * calls `projectClientContext` — the same function the peer-facing tool will
 * call when that tool can exist — and hands back its output unchanged. 🚫 It
 * must never build a friendlier, fuller or differently-worded version for the
 * console: two answers to "what may a peer name?" means the one that drifts is
 * still the one the operator trusts, and the operator would be auditing a
 * rendering rather than the thing itself.
 *
 * 🛑 **NO PEER CAN ACTUALLY ASK YET, AND THE OPERATOR IS TOLD SO.** Deliverable
 * 7's other half — `age_get_client_context`, entitled on read — is blocked: the
 * only `Authentication` anyone can construct today is `none`, so a tool wired
 * through `readWithinEntitlement` would refuse every call (ADR-0068 §0.1b).
 * Showing this projection without saying that would let an operator conclude
 * peers are already being served. 🚫 Do not close that gap here by adding a
 * caller, a token, a session or a route — this reads a store for a screen.
 *
 * 🛑 **IT OPENS ONE STORE, AND ONLY ONE.** The projection answers "what does AGE
 * model?", which is a question about the business context alone. The observation
 * store is not opened, not read and not needed — 🚫 and it must not be, because
 * mixing in what a source reported would turn a statement about AGE's own model
 * into a statement about what the world has said, which is the category
 * confusion the three-way separation exists to prevent.
 *
 * 🛑 **NO STORED CONTEXT IS ITS OWN OUTCOME**, exactly as it is for the
 * derivation and as `contextNotFound` is in the relay CLI. AGE holding no
 * context means there is no model to project — 🚫 never an empty subject list,
 * which would tell a reader AGE models nothing about this business.
 *
 * ⚠️ **`asOf` IS THE STORED `capturedAt`, 🚫 NEVER A CLOCK.** It is read off the
 * row and passed in. Reading a clock here would stamp the projection "now" and
 * claim a freshness the stored context cannot support.
 *
 * 🚫 **IT CANNOT WRITE, AND NOT BECAUSE IT DECLINES TO.** The port carries a
 * read and a close; there is no `append` on it to call. It is opened only AFTER
 * the client record resolves — an unknown business must cost nothing and reach
 * nothing.
 */

export type ClientContextProjectionOutcome =
  | {
      readonly kind: 'projected';
      readonly projection: ClientContextProjection;
      /** Echoed so the operator can see the scope was DERIVED, not typed. */
      readonly organizationId: string;
    }
  /**
   * 🛑 AGE holds no context under this BIF id, so there is nothing to project.
   * 🚫 Never rendered as a projection with an empty subject list.
   */
  | { readonly kind: 'no-context'; readonly reason: string }
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'refused'; readonly reason: string };

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** 🚫 A statement about the QUERY, never about the business. */
const noContextReason = (bifId: string): string =>
  `AGE holds no stored business context under BIF id "${bifId}" for this business, so there is ` +
  'nothing to project — not an empty projection, which would say AGE models nothing about this ' +
  'business. A BIF id that was never captured under and a business that was never captured look ' +
  'identical from here, and neither is a statement about the business.';

export async function readClientContextProjection(
  runtime: OperatorWorkspaceRuntime,
  openContextRead: OpenSnapshotRead,
  entitledOrganizationId: string,
  clientId: string,
  bifId: string,
): Promise<ClientContextProjectionOutcome> {
  const trimmedBifId = bifId.trim();
  if (trimmedBifId === '') {
    // 🚫 Never defaulted and never derived — the id was chosen at capture time,
    // and guessing one would query a scope nobody wrote to.
    return {
      kind: 'refused',
      reason:
        'A BIF id is required. AGE cannot derive it: the id was chosen when the business context ' +
        'was captured, and reading across snapshots to find it is not authorized.',
    };
  }

  const scope = resolveBusinessScope(runtime, entitledOrganizationId, clientId);
  if (scope.kind === 'not-configured') {
    return { kind: 'not-configured', variable: scope.variable };
  }
  if (scope.kind === 'refused') {
    return { kind: 'refused', reason: scope.reason };
  }
  if (scope.kind === 'unknown-client') {
    return {
      kind: 'refused',
      // ⚠️ Its own words, deliberately. Repeating another operation's sentence
      // here would make this look like a second `resolveBusinessScope`.
      reason:
        'That business is not in the client record file, so there is no scope to project under. ' +
        'Nothing is guessed: the organization is only ever read off the record.',
    };
  }

  let contextPort: SnapshotReadPort;
  try {
    contextPort = await openContextRead();
  } catch (error) {
    // ⚠️ A deployment fault, named as one. 🚫 No connection string travels.
    return { kind: 'refused', reason: messageOf(error) };
  }

  let found;
  try {
    // ⚠️ A stored row is untrusted input; one that fails validation refuses the
    // whole read rather than being projected in part.
    found = await contextPort.findLatest({
      clientId: scope.client.clientId,
      organizationId: scope.client.organizationId,
      bifId: trimmedBifId,
    });
  } catch (error) {
    return {
      kind: 'refused',
      reason:
        `The stored business context could not be read back: ${messageOf(error)} Nothing is ` +
        'projected, because a row that failed validation is not a row AGE can describe in part.',
    };
  } finally {
    await contextPort.close();
  }

  if (found === null) {
    return { kind: 'no-context', reason: noContextReason(trimmedBifId) };
  }

  return {
    kind: 'projected',
    // ⚠️ The stored capture time, carried in. 🚫 Never `now`.
    projection: projectClientContext({ context: found.snapshot.context, asOf: found.capturedAt }),
    organizationId: scope.client.organizationId,
  };
}
