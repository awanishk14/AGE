import type { OperatorSessionScopeRunner } from './operator-session-scope-runner';

/**
 * The adapter that makes `verifyPresentedSessionToken` executable against the
 * real store — the last thing ADR-0068 §0.1b lowered and the last thing slice 7
 * owed in code.
 *
 * 🛑 **VERIFICATION IS NOT ISSUANCE, AND NOTHING HERE COULD BECOME ISSUANCE.**
 * This module reads. The delegate it is handed offers `findUnique` and nothing
 * else, the table grants `SELECT` and nothing else, and the policy is `FOR
 * SELECT` with no `WITH CHECK`. Provisioning the second operator stays an ACT
 * performed out of band (§0.1c refuses every provisioning surface by name).
 *
 * 🛑 **IT IS A LOOKUP, 🚫 NOT A VERIFIER.** It reaches no conclusion about the
 * row: it does not compare digests, does not read a clock, does not check
 * revocation or expiry, and does not normalize. Every one of those decisions
 * belongs to `@age/session-store`, which has exactly one implementation of each.
 * 🚫 A second copy here is how the two drift, and the copy that gets relaxed
 * still passes its own tests.
 *
 * ⚠️ **IT RECEIVES A DIGEST AND NEVER A TOKEN.** The credential is hashed
 * before this layer exists, so no adapter, query log or trace here can capture
 * it. This package cannot hash — it has no `node:crypto` — which is why it
 * cannot be handed the token even by a caller trying to.
 *
 * ⚠️ **THE ROW TRAVELS BACK RAW.** It is returned as `unknown`, untouched, so
 * that `normalizeSessionRecord` re-validates it as the untrusted input it is
 * (ADR-0031's rule). 🚫 Shaping it here would hand the verifier something that
 * merely looks already-checked.
 */

/**
 * Builds the `findRowByTokenHash` function `verifyPresentedSessionToken` takes.
 *
 * ⚠️ **THE ORGANIZATION IS REQUIRED, AND 🚫 IT IS NOT DEFAULTED.** The RLS
 * policy on `operator_sessions` fails closed, so an unscoped read returns no
 * rows — which the verifier would report as `no-such-session`, a refusal
 * indistinguishable from a bad credential. A caller therefore names the tenant
 * it is presenting a token for. 🚫 There is no "all organizations" value and no
 * fallback: an absent scope is a caller error, never a wider read.
 *
 * ⚠️ The organization is bound at construction, once, by whoever knows the
 * scope — so the returned function has exactly the shape the pure verifier
 * declares, and 🚫 the verifier never learns that a scope exists, let alone how
 * to change one.
 */
export function operatorSessionLookup(
  runner: OperatorSessionScopeRunner,
  scope: { readonly organizationId: string },
): (tokenHash: string) => Promise<unknown> {
  return async (tokenHash: string): Promise<unknown> =>
    runner.runInScope({ organizationId: scope.organizationId }, async (sessions) => {
      // ⚠️ At most one row: `token_hash` is UNIQUE, so "which session is this"
      // has exactly one answer. 🚫 A `findMany` here would make "several
      // sessions share a digest" a state this code could survive.
      const row: unknown = await sessions.findUnique({ where: { tokenHash } });

      // ⚠️ `null` travels as `null`. 🚫 It is not turned into a refusal, an
      // error or an empty object here — "AGE holds no such row" is a FACT the
      // verifier distinguishes from "AGE holds one it has decided against", and
      // collapsing them here would destroy that distinction before it is made.
      return row;
    });
}
