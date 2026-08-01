import { z } from 'zod';

/**
 * OperatorPrincipal — authorship without authentication (ADR-0053 D4).
 *
 * An operator principal asserts exactly one thing: **a named human operator
 * acted.** It does NOT assert an authenticated session, a user account, a role,
 * or a permission.
 *
 * ⚠️ This is the load-bearing distinction, and it is what ADR-0050 D5/D7 were
 * actually protecting. Those blockers refused a FABRICATED principal — a fixed
 * constant pretending to be a user. This is not that. It is a SMALLER TRUE
 * CLAIM, not a smaller lie: the system says only what it can support.
 *
 * 🚫 It is never defaulted, never optional, and never inferred (ADR-0049 D2).
 * A caller that cannot name the operator does not get a generated one.
 *
 * 🚫 It must NEVER be treated as an authorization decision. No code may branch
 * on it to grant or deny anything. It is provenance.
 *
 * ⚠️ When real authentication arrives, an authenticated principal SUPERSEDES
 * this; it does not reinterpret history. Values already stamped
 * `operator:<handle>` stay true, because they always described an operator
 * action and never claimed more.
 */

declare const operatorPrincipalBrand: unique symbol;

export type OperatorPrincipal = string & { readonly [operatorPrincipalBrand]: true };

export const OPERATOR_PRINCIPAL_PREFIX = 'operator:';

/**
 * A handle is a short, stable, lowercase identifier for a human operator.
 *
 * Constrained deliberately: a principal ends up in permanent provenance, so a
 * value that varies by casing or whitespace would make the same person look
 * like two.
 */
const handleSchema = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9._-]{0,63}$/,
    'an operator handle must be 1-64 chars of lowercase letters, digits, dot, underscore or hyphen, and must not start with a separator',
  );

/**
 * Build a principal from a handle. Throws on anything else.
 *
 * ⚠️ Throwing is the point. Dissent 1 against ADR-0053 stands: nothing here
 * verifies that the named operator is who acted, so the one control available
 * is refusing a value that is malformed rather than silently normalising it
 * into something that looks fine.
 */
export function operatorPrincipal(handle: string): OperatorPrincipal {
  const parsed = handleSchema.parse(handle);
  return `${OPERATOR_PRINCIPAL_PREFIX}${parsed}` as OperatorPrincipal;
}

/** Narrow an untrusted value to a principal, without inventing one. */
export function isOperatorPrincipal(value: unknown): value is OperatorPrincipal {
  if (typeof value !== 'string' || !value.startsWith(OPERATOR_PRINCIPAL_PREFIX)) {
    return false;
  }
  return handleSchema.safeParse(value.slice(OPERATOR_PRINCIPAL_PREFIX.length)).success;
}

/**
 * Parse an untrusted value into a principal. Throws when it is not one.
 *
 * 🚫 There is deliberately no `operatorPrincipalOrDefault`, no
 * `SYSTEM_PRINCIPAL`, and no anonymous fallback. Provenance that cannot be
 * supplied is a failure, not a value.
 */
export function parseOperatorPrincipal(value: unknown): OperatorPrincipal {
  if (!isOperatorPrincipal(value)) {
    throw new Error(
      'an operator principal is required and must look like "operator:<handle>" (ADR-0053 D4); it is never defaulted, generated or inferred',
    );
  }
  return value;
}
