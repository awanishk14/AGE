/**
 * `@age/tenant-workspace` — ADR-0061 **A4** and nothing else.
 *
 * 🚫 **THIS PACKAGE PERFORMS NO EFFECT AND HAS NO CALLER YET.** It decides about
 * STRINGS: it does not create a directory, does not open a file, does not list
 * one, and does not know whether any of the paths it returns exist. Wiring it
 * into a read path is A5's slice and the deployment's, not this one's.
 *
 * 🚫 **NOTHING HERE AUTHORIZES A READ.** A per-tenant directory is a placement
 * rule; who may read what is `askEntitlement` (A2/A3). Treating a path as an
 * authorization is the same error as treating the loopback bind as one.
 */

export {
  assertPathWithinTenantWorkspace,
  deriveTenantWorkspaceRoot,
  OperatorFilePathRefusedError,
  TenantWorkspaceRefusedError,
  type DeriveTenantWorkspaceRootOptions,
} from './tenant-workspace-root';
