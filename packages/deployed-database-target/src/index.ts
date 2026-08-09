/**
 * `@age/deployed-database-target` — ADR-0061 **A5** and nothing else.
 *
 * 🛑 **THE TRADE, STATED WHERE IT CANNOT BE MISSED: this package exists because
 * a real client's data will live on a server the operator does not physically
 * hold.** ADR-0055 D6 refused that; ADR-0061 A5 revisits it deliberately, and it
 * is the Product Owner's call, not the architect's. 🚫 It must never be
 * described as anything other than a reduction in safety that was chosen.
 *
 * 🚫 **THIS PACKAGE PERFORMS NO EFFECT AND HAS NO CALLER YET.** It decides about
 * STRINGS: it opens no connection, constructs no `PrismaClient`, reads no
 * environment and resolves no name. Building the deployment composition on top
 * of it is the deployment slice's work, gated by **A6**.
 *
 * 🚫 **IT REPLACES NOTHING ON THE LOCAL PATH.** `assertLocalDatabaseTarget` in
 * `apps/capture` keeps its teeth, is a different code path, and is 🚫 not
 * imported, relaxed or re-implemented here.
 *
 * 🚫 **NOTHING HERE AUTHORIZES A READ.** Where a row may be stored is not who may
 * read it — that is A2/A3 and `askEntitlement`.
 */

export {
  assertDeployedDatabaseTarget,
  DEPLOYED_DATABASE_COMPOSITION_NAME,
  deployedDatabaseTargetHost,
  DeployedDatabaseTargetRefusedError,
  REMOTE_ACKNOWLEDGEMENT,
  selectDeployedDatabaseComposition,
  type DeployedDatabaseComposition,
  type DeployedDatabaseUrl,
  type RemoteAcknowledgement,
  type SelectDeployedDatabaseCompositionOptions,
} from './deployed-database-target';
