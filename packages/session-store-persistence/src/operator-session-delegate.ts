/**
 * The narrowest possible view of the Prisma model delegate for
 * `OperatorSession`, declared STRUCTURALLY here rather than imported from
 * `@prisma/client` — the same construction `@age/source-observation-persistence`
 * and `@age/scored-bif-snapshot-persistence` use, and for the same reasons: this
 * package typechecks with zero generated code and zero database, while a real
 * `PrismaClient.operatorSession` satisfies it structurally at a composition
 * root.
 *
 * 🛑 **WHAT IS ABSENT IS THE POINT, AND HERE IT IS THE WHOLE ARGUMENT.** There
 * is no `create`, no `createMany`, no `update`, no `updateMany`, no `upsert`, no
 * `delete` and no `deleteMany`. `operator_sessions` holds `GRANT SELECT` and
 * nothing else, and it has a `FOR SELECT` policy with 🚫 no `WITH CHECK` — so
 * 🛑 **VERIFICATION IS NOT ISSUANCE holds twice over**: once at the database,
 * which would reject a write, and once here, where the type offers no way to
 * express one. 🚫 Widening this interface is the issuance path ADR-0068 §0.1c
 * refuses by name, and it would need its own ADR.
 *
 * 🚫 **THERE IS NO `findMany` EITHER.** Listing sessions is how a surface starts
 * showing an operator who else is signed in, which is the second-operator UI
 * §0.1c refuses. The only read AGE performs is "does one row match this digest,
 * in this scope" — `findUnique`, and nothing wider.
 */

/**
 * The lookup argument.
 *
 * ⚠️ **A DIGEST, 🚫 NEVER A TOKEN.** The presented credential is hashed by
 * `@age/session-store` before this layer is reached, so an adapter — or a query
 * log, or a slow-query trace — cannot capture the credential even by accident.
 * This package has no way to hash, which is why it cannot be handed one.
 */
export interface OperatorSessionLookupWhere {
  readonly tokenHash: string;
}

export interface OperatorSessionDelegate {
  /**
   * Reads at most one row by its unique digest.
   *
   * ⚠️ Returns `unknown`: a row is UNTRUSTED INPUT and is re-validated by
   * `normalizeSessionRecord` (`@age/session-store`), which is the ONE
   * implementation of that rule. 🚫 This package must not grow a second, and
   * 🚫 must not shape the row into something that looks already-validated.
   */
  findUnique(args: { readonly where: OperatorSessionLookupWhere }): Promise<unknown>;
}
