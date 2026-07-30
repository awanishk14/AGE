/**
 * Client helpers for the read-only AGE capability demo.
 *
 * Talks to the API's `GET /demo/capabilities` endpoint. No writes, no
 * approval/execution behaviour — this only reads demo data for display.
 */

/** One approval-pending decision object, flattened by the API. */
export interface PendingApprovalRef {
  readonly capability: string;
  readonly id: string;
}

/** Per-capability report as returned by `GET /demo/capabilities`. */
export interface CapabilityDemoReport {
  readonly capability: string;
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly duplicateCount: number;
  readonly derivedCount: number;
  readonly inputItemCount: number;
  readonly accountingHolds: boolean;
  readonly acceptedItems: readonly unknown[];
  readonly rejectedReasons: readonly unknown[];
  readonly duplicateReferences: readonly unknown[];
  readonly pendingApproval: readonly PendingApprovalRef[];
  readonly extra?: Readonly<Record<string, number>>;
}

/**
 * The upstream Business Discovery intake, as returned by the API.
 *
 * Not a capability: it produces no decision objects and never enters the
 * approval model. The four scores are two distinct pairs — `discovery*`
 * describes the interview, `bif*` describes the produced Draft BIF — and must
 * never be presented as interchangeable.
 */
export interface BusinessDiscoveryDemoSummary {
  readonly profileId: string;
  readonly businessName: string;
  readonly questionnaireId: string;
  readonly questionnaireVersion: string;
  readonly profileSchemaValid: boolean;
  readonly questionnaireValid: boolean;
  readonly missingRequiredCount: number;
  readonly criticalGapCount: number;
  readonly discoveryCompletenessScore: number;
  readonly discoveryConfidenceScore: number;
  readonly bifCompletenessScore: number;
  readonly bifConfidenceScore: number;
  readonly bifStatus: string;
  readonly presentSectionTypes: readonly string[];
  readonly omittedSectionTypes: readonly string[];
  readonly evidenceReferenceCount: number;
  readonly assumptionCount: number;
  readonly goalCount: number;
  readonly offeringCount: number;
  readonly customerSegmentCount: number;
  readonly competitorCount: number;
}

/** Top-level response envelope for the capability demo endpoint. */
export interface CapabilityDemoResponse {
  readonly title: string;
  readonly description: string;
  readonly humanApprovedExecution: boolean;
  readonly sideEffectsPerformed: boolean;
  readonly businessDiscovery: BusinessDiscoveryDemoSummary;
  readonly reports: readonly CapabilityDemoReport[];
  readonly summary: {
    readonly capabilitiesRun: number;
    readonly totalPendingApprovals: number;
    readonly accountingInvariantHolds: boolean;
  };
}

/** Sensible local default matching the API's default port (API_PORT ?? 4000). */
export const DEFAULT_API_BASE_URL = 'http://localhost:4000';

/**
 * Resolve the API base URL from the public env var, falling back to the local
 * default. Reuses the existing `NEXT_PUBLIC_API_URL` convention (see
 * `.env.example`). Trailing slashes are trimmed for safe path joining.
 */
export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  const base = raw && raw.length > 0 ? raw : DEFAULT_API_BASE_URL;
  return base.replace(/\/+$/, '');
}

/** Fetch the capability demo payload. Throws on network or non-2xx responses. */
export async function fetchCapabilityDemo(signal?: AbortSignal): Promise<CapabilityDemoResponse> {
  const response = await fetch(`${getApiBaseUrl()}/demo/capabilities`, {
    signal,
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`API responded with ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as CapabilityDemoResponse;
}

/** Compact one-line JSON for a decision object, safe for list rendering. */
export function formatDecisionItem(item: unknown): string {
  try {
    return JSON.stringify(item);
  } catch {
    return String(item);
  }
}
