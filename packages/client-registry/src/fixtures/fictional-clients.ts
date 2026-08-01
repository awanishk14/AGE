import { parseClientRecord, type ClientRecord } from '../client-record';

/**
 * Fictional client records, for tests and examples ONLY.
 *
 * 🚫 REAL CLIENT RECORDS ARE NEVER COMMITTED (ADR-0053 D3). `awanishk14/AGE` is
 * a PUBLIC repository. A committed registry would publish the operator's client
 * roster together with their ad-account and property identifiers.
 *
 * 🚫 Not even redacted or partially masked: a masked ad account id is still an
 * assertion about who the operator's clients are.
 *
 * 🚫 Do NOT "make the fixtures more realistic". Their obvious fictionality is
 * the control, and `fictional-clients.spec.ts` fails if it erodes.
 *
 * Concrete records for real clients are supplied from a local, gitignored
 * source at run time and are not part of this repository.
 */

/** The marker every fictional value carries, asserted by the guard test. */
export const FICTIONAL_MARKER = 'example';

export const FICTIONAL_CLIENT_RECORDS: readonly ClientRecord[] = Object.freeze([
  parseClientRecord({
    clientId: 'client-example-001',
    organizationId: 'org-example-001',
    displayName: 'Example Widgets Ltd (fictional)',
    externalRefs: {
      rankops: 'rankops-client-example-001',
      googleAds: 'google-ads-example-000-000-0000',
      metaAds: 'meta-ads-example-000000000000000',
      website: 'website-project-example',
    },
  }),
  parseClientRecord({
    clientId: 'client-example-002',
    organizationId: 'org-example-001',
    displayName: 'Example Clinic Co (fictional)',
    externalRefs: {
      rankops: 'rankops-client-example-002',
      website: 'website-project-example-two',
    },
  }),
]);
