import { createTrustedOperatorTenantContext } from '@age/platform-context';
import type { TrustedOperatorTenantContext } from '@age/platform-context';

/**
 * Explicit, request-provided fields as currently accepted by the API/Web
 * demo/test-safe surface (ADR-0023 Slices D2/D3; ADR-0024 §3 "Demo/test-safe
 * scope"). These are the same field names already used by
 * `RecordApprovalDecisionRequestDto` and friends.
 */
export interface TrustedContextRequestFields {
  readonly organizationId: string;
  readonly clientId: string;
  readonly projectId?: string;
  readonly operatorId: string;
}

/**
 * Bridges the current explicit request/query fields into an ADR-0024
 * `TrustedOperatorTenantContext`, using the validating factories from
 * `@age/platform-context`.
 *
 * **Demo/test-safe only.** This does not implement production
 * authentication: it trusts whatever `operatorId`/`organizationId`/
 * `clientId`/`projectId` the caller supplied, exactly as ADR-0024 §3
 * describes as the current, intentionally unchanged demo/test-safe scope.
 * The caller is always treated as a `human` operator — no system-actor
 * inference is made from request fields.
 *
 * Production auth integration (a future, separate slice) must instead
 * derive operator identity from authenticated context (session/JWT) and
 * validate tenant scope against the operator's verified memberships, per
 * ADR-0024 §1–§3 — never from these request fields directly.
 *
 * No routes call this yet; it is a bridge/foundation adapter only.
 */
export function createDemoTrustedContextFromRequestFields(
  fields: TrustedContextRequestFields,
): TrustedOperatorTenantContext {
  return createTrustedOperatorTenantContext({
    operatorKind: 'human',
    operator: { operatorId: fields.operatorId },
    scope: {
      organizationId: fields.organizationId,
      clientId: fields.clientId,
      ...(fields.projectId === undefined ? {} : { projectId: fields.projectId }),
    },
  });
}
