import type { ExecutionDomain } from '@age/capability-kit';

/**
 * ExecutionScope — the single Organization / Client / Project an execution is
 * bound to. Execution never crosses Client or tenant boundaries (Doc 12 §7).
 */
export interface ExecutionScope {
  readonly organizationId: string;
  readonly clientId: string;
  readonly projectId?: string;
}

/**
 * ExecutionTarget — *where* an execution would act: an ExecutionDomain
 * (ADR-0007) within a scope. This slice never actually acts on the domain; the
 * target only describes where a real execution would later be fulfilled.
 */
export interface ExecutionTarget {
  readonly executionDomain: ExecutionDomain;
  readonly scope: ExecutionScope;
}
