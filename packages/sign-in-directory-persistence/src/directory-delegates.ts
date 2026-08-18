/**
 * The narrowest possible view of the two Prisma delegates the sign-in directory
 * read needs, declared STRUCTURALLY rather than imported from `@prisma/client` —
 * the same construction every other persistence package here uses, and for the
 * same reason: this package typechecks with zero generated code and zero
 * database, while a real client satisfies it structurally at a composition root.
 *
 * 🛑 **READ-ONLY BY CONSTRUCTION, AND HERE THAT IS THE WHOLE ARGUMENT.** There
 * is no `create`, no `createMany`, no `update`, no `updateMany`, no `upsert`, no
 * `delete` and no `deleteMany` on either delegate. `accounts` and
 * `account_memberships` hold `GRANT SELECT` and nothing else — ADR-0079
 * overturned the refusal on issuing SESSIONS and 🚫 nothing else — so
 * 🛑 **AGE MINTS NOTHING** holds twice over: once at the database, which would
 * reject a write, and once here, where the type offers no way to express one.
 * 🚫 Widening either interface is a provisioning path, and it would need its own
 * ADR **and** its own migration.
 */

/** 🚫 An email and nothing else. There is no id lookup: sign-in knows a name, not a row. */
export interface DirectoryAccountWhere {
  readonly email: string;
}

export interface DirectoryAccountDelegate {
  /**
   * Reads at most one account by its unique address.
   *
   * ⚠️ Returns `unknown`: a row is UNTRUSTED INPUT (ADR-0031's rule) and is
   * re-validated by this package's normalizer before `decideSignIn` sees it.
   * 🚫 This delegate must not shape the row into something already-checked.
   */
  findUnique(args: { readonly where: DirectoryAccountWhere }): Promise<unknown>;
}

export interface DirectoryMembershipDelegate {
  /**
   * Reads every membership row for ONE account.
   *
   * ⚠️ **`findMany` HERE IS NOT THE `findMany` THE SESSION STORE REFUSES.**
   * That refusal — "listing sessions is the second-operator UI" — is about
   * enumerating CREDENTIALS. This lists one person's own memberships, which is
   * exactly the question admission asks, and 🛑 the `where` cannot express any
   * broader one: there is no way to ask for every membership in the scope, so
   * this delegate cannot become a directory browser.
   */
  findMany(args: { readonly where: { readonly accountId: string } }): Promise<readonly unknown[]>;
}
