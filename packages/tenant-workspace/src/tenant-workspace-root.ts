import type { AuthenticatedOrganizationId } from '@age/entitlement';
import {
  assertOperatorFilePathOutsideRepository,
  OperatorFilePathRefusedError,
} from '@age/operator-file-policy';

/**
 * ADR-0061 **A4** — where the operator's files live when the operator is not at
 * the machine.
 *
 * **The workspace root is derived from the authenticated organization, and 🚫
 * never from a request parameter.**
 *
 * ⚠️ **ADR-0054 D2 IS PRESERVED BY BEING RESTATED, NOT DROPPED.** Its point was
 * that a path is never *ambient* — never `cwd`, never a default, never a search.
 * Deployed, the non-ambient source is the SESSION. 🚫 A path segment arriving in
 * a URL, a form field or a header is user input, and a user-supplied path
 * segment is a traversal into another tenant's files.
 *
 * 🚫 **`assertOperatorFilePathOutsideRepository` KEEPS ITS ONE IMPLEMENTATION**
 * (ADR-0054 D3). It is IMPORTED here, never re-implemented: the deployed root is
 * an additional constraint on top of that rule, 🚫 not a second copy of it that
 * quietly relaxes it.
 *
 * ⚠️ **THIS SETTLES WHERE A FILE LIVES, 🚫 NOT WHO MAY READ IT.** That is A2/A3
 * and `askEntitlement`, exactly as ADR-0061 §2 Q4 warned. 🚫 A tenant directory
 * is not an authorization, and object storage would not be an answer either.
 *
 * Pure: no clock, no ids, no randomness, no I/O, no `node:path` — path
 * arithmetic here is the same hand-rolled string arithmetic ADR-0054 D2 requires,
 * because `path.resolve` consults `process.cwd()`.
 */

/** Refusal raised when a tenant workspace root cannot be derived or honoured. */
export class TenantWorkspaceRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantWorkspaceRefusedError';
  }
}

/**
 * ⚠️ **AN ALLOW-LIST, 🚫 NEVER A DENY-LIST.** Rejecting `..` and `/` by name
 * leaves `%2e%2e`, a NUL, a backslash, a drive letter, a leading dash and every
 * encoding anyone thinks of next. What is permitted is stated instead, so an
 * identifier that has not been thought about is refused rather than allowed.
 */
const SAFE_SEGMENT = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/;

function assertSafeSegment(organizationId: string): void {
  if (!SAFE_SEGMENT.test(organizationId)) {
    // 🚫 The refusal does NOT echo the identifier: an organization identifier in
    // a log is a real tenant named in a log (ADR-0054 D3).
    throw new TenantWorkspaceRefusedError(
      'That organization identifier cannot be used as a directory name. Only lower-case ' +
        'letters, digits and inner hyphens are permitted, 2 to 64 characters. This is an ' +
        'allow-list: an identifier nobody anticipated is refused rather than joined onto a path.',
    );
  }
}

export interface DeriveTenantWorkspaceRootOptions {
  /**
   * The deployment's workspace area — one absolute path, configured once for the
   * server. 🚫 Never per-request, and 🚫 never a default: A4's whole point is that
   * no part of a path is ambient.
   */
  readonly deploymentWorkspaceRoot: string;
  /**
   * The tenant, and the ONLY thing that varies between callers.
   *
   * ⚠️ Its type cannot be produced from a string, so a request parameter cannot
   * reach this argument (`authenticatedOrganizationIdOf` is the only source).
   */
  readonly organizationId: AuthenticatedOrganizationId;
  /**
   * Checked against ADR-0054 D2's one rule, unchanged. Deployed, the repository
   * is not usually present — but a root inside a checkout is exactly the mistake
   * the local rule exists to catch, and it is still worth catching.
   */
  readonly repositoryRoot: string;
}

/**
 * Derives the one directory a given tenant's operator files may live under.
 *
 * @throws {TenantWorkspaceRefusedError} if the identifier cannot be a directory
 *         name, or the deployment root is blank.
 * @throws {OperatorFilePathRefusedError} if the derived root is not absolute or
 *         falls inside the repository working tree.
 */
export function deriveTenantWorkspaceRoot(options: DeriveTenantWorkspaceRootOptions): string {
  const { deploymentWorkspaceRoot, organizationId, repositoryRoot } = options;

  const base = deploymentWorkspaceRoot.trim().replace(/\\/g, '/').replace(/\/+$/, '');
  if (base === '') {
    throw new TenantWorkspaceRefusedError(
      'The deployment workspace root is required and must not be blank. There is no default ' +
        'location, because a default location is an ambient one.',
    );
  }

  assertSafeSegment(organizationId);

  const root = `${base}/${organizationId}`;

  // ⚠️ Order is load-bearing: the shared rule runs on the DERIVED path, so a
  // deployment root that happens to sit inside a checkout is refused as a whole
  // rather than per-file, later, by whoever remembers.
  assertOperatorFilePathOutsideRepository(root, repositoryRoot, 'tenant workspace root');

  return root;
}

/**
 * Refuses any path that is not inside the given tenant's workspace root.
 *
 * ⚠️ **THIS IS THE CHECK THAT MAKES THE DERIVATION WORTH ANYTHING.** Deriving a
 * per-tenant root and then opening whatever path a caller supplies leaves the
 * tenants exactly as mixed as before.
 *
 * ⚠️ `..` is not searched for — the candidate is NORMALIZED and then compared,
 * so `…/org-a/../org-b/secrets.json` is refused for the place it actually
 * reaches rather than for the characters it contains.
 */
export function assertPathWithinTenantWorkspace(
  candidatePath: string,
  tenantWorkspaceRoot: string,
  subject: string,
): void {
  const named = subject.trim();
  if (named === '') {
    throw new TenantWorkspaceRefusedError(
      'The subject of a tenant workspace check is required: a refusal that does not say which ' +
        'file was refused cannot be acted on.',
    );
  }

  const candidate = normalize(candidatePath);
  const root = normalize(tenantWorkspaceRoot);

  if (root === '') {
    throw new TenantWorkspaceRefusedError(
      `The tenant workspace root is required to place a ${named}, and it was blank.`,
    );
  }

  if (candidate !== root && !candidate.startsWith(`${root}/`)) {
    // 🚫 Names neither path: one of them is another tenant's.
    throw new TenantWorkspaceRefusedError(
      `Refused: that ${named} is outside the workspace of the organization the session speaks ` +
        'for. A path is reached, not spelled — this is judged after normalization, so climbing ' +
        'out with "." or ".." is refused for where it arrives.',
    );
  }
}

/**
 * ⚠️ Case-insensitive on every platform, like the shared rule it sits beside: it
 * refuses MORE paths than a case-sensitive filesystem strictly requires, which
 * is the fail-closed direction.
 */
function normalize(path: string): string {
  const slashed = path.trim().replace(/\\/g, '/');
  const drive = /^[A-Za-z]:\//.exec(slashed);
  const prefix = drive ? slashed.slice(0, 3) : slashed.startsWith('/') ? '/' : '';

  const segments: string[] = [];
  for (const segment of slashed.slice(prefix.length).split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  const joined = `${prefix}${segments.join('/')}`.toLowerCase();
  return joined.length > 1 && joined.endsWith('/') ? joined.slice(0, -1) : joined;
}

export { OperatorFilePathRefusedError };
