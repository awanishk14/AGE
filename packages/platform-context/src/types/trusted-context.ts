import type { OperatorContext } from './operator-context';
import type { TenantScope } from './tenant-scope';

/**
 * TrustedOperatorTenantContext — the combined, validated operator identity +
 * tenant scope for a request (ADR-0024). Constructible only through
 * ./factory helpers; no request-body field is trusted as production
 * behavior by this type alone — resolving/validating that trust is the
 * caller's responsibility (out of scope for this foundation slice).
 */
export interface TrustedOperatorTenantContext {
  readonly operator: OperatorContext;
  readonly scope: TenantScope;
}
