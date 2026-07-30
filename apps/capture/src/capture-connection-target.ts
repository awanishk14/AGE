/**
 * Which database identity the capture CLI is entitled to connect as
 * (ADR-0046 D4, Slice 2).
 *
 * THE DEFECT THIS CLOSES. The composition root used to construct a bare
 * `PrismaClient`, which resolves `DATABASE_URL` through the schema's
 * `datasource` block. Repo-wide `DATABASE_URL` is the **owner** connection —
 * `ci-db.yml` creates the non-owner application role under a separate
 * `DATABASE_URL_APP` — and the name `DATABASE_URL_APP` appeared nowhere in
 * `apps/capture` at all. So the one production chain that exists to write
 * scoped rows asserted nothing whatsoever about the role it would write them
 * as, and would silently have taken whichever identity the environment happened
 * to hold.
 *
 * WHY THAT MATTERS EXACTLY AS MUCH AS IT DOES, AND NO MORE. RLS here is a
 * COHERENCE constraint, not an authorization boundary (ADR-0046 D5): the scoped
 * repository derives the GUCs from the record's own key, so scope and row agree
 * by construction. Connecting as the owner does not merely weaken that — the
 * table's policies stop applying at all, and the single mechanism that makes a
 * mis-scoped INSERT impossible is gone. It still buys **no** isolation between
 * two tenants sharing `age_app`. Both halves are true; neither is a reason to
 * skip this.
 *
 * FAIL CLOSED, AND FAIL BEFORE CONNECTING. An unresolvable target is an error,
 * never a fallback: a CLI that quietly downgrades to the owner connection when
 * its app credentials are missing is worse than one that refuses, because the
 * run that needed the guard most is exactly the run that lost it. The refusal
 * happens here, above `new PrismaClient(`, so a misconfigured environment never
 * opens a connection at all.
 *
 * PURE. This module reads no environment of its own — it takes one. That is
 * what makes every branch below testable without mutating `process.env`, and it
 * keeps the effect at the composition root where the repo's other effects live.
 *
 * ⚠️ NO CREDENTIAL IS EVER RETURNED IN AN ERROR. The messages name the
 * variables, never their values; a connection string carries a password.
 */

/** The environment slice this resolution depends on. Nothing wider is read. */
export interface CaptureConnectionEnvironment {
  readonly [key: string]: string | undefined;
}

export type ResolvedCaptureDatasource =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly errors: readonly string[] };

/** The non-owner application role's connection. The only accepted identity. */
export const CAPTURE_DATASOURCE_ENV_VAR = 'DATABASE_URL_APP';

/** The owner connection. Named only so it can be refused, never to be used. */
export const OWNER_DATASOURCE_ENV_VAR = 'DATABASE_URL';

const isBlank = (value: string | undefined): value is undefined | '' =>
  value === undefined || value.trim() === '';

/**
 * Resolves the connection the capture chain may open, or explains why it may
 * not open one.
 *
 * Never throws and never reads ambient state: every input arrives as an
 * argument, and every failure is returned as text an operator can act on.
 *
 * @param environment the environment to read, typically `process.env`
 */
export function resolveCaptureDatasourceUrl(
  environment: CaptureConnectionEnvironment,
): ResolvedCaptureDatasource {
  const appUrl = environment[CAPTURE_DATASOURCE_ENV_VAR];
  const ownerUrl = environment[OWNER_DATASOURCE_ENV_VAR];

  if (isBlank(appUrl)) {
    return {
      ok: false,
      errors: [
        `${CAPTURE_DATASOURCE_ENV_VAR} is not set. The capture CLI connects only as the ` +
          `non-owner application role; it never falls back to ${OWNER_DATASOURCE_ENV_VAR}, ` +
          'which is the owner connection and is not subject to the row-level policies that ' +
          'keep a written row and its declared scope in agreement.',
      ],
    };
  }

  if (!isBlank(ownerUrl) && appUrl.trim() === ownerUrl.trim()) {
    return {
      ok: false,
      errors: [
        `${CAPTURE_DATASOURCE_ENV_VAR} and ${OWNER_DATASOURCE_ENV_VAR} are the same connection. ` +
          'Pointing the application variable at the owner connection satisfies the name while ' +
          'discarding the guarantee; set it to the non-owner role instead.',
      ],
    };
  }

  return { ok: true, url: appUrl.trim() };
}
