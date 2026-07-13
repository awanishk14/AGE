import { ClientContext } from '@age/capability-kit';

/**
 * The authoritative demo scope. `ClientContext` remains authoritative for output
 * scoping across every capability (ADR-0016/0017/0018/0019); the per-input
 * `clientId`/`organizationId` fields are provenance/scope only.
 */
export const demoContext = new ClientContext('client-demo-001', 'org-demo-001');
