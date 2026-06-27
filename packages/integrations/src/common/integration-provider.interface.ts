/**
 * IntegrationProvider — the common contract every AGE integration implements.
 *
 * Placeholder. No network calls or auth flows are defined yet.
 */
export interface IntegrationProvider {
  /** Stable machine identifier, e.g. "google-ads". */
  readonly id: string;
  /** Human-readable name, e.g. "Google Ads". */
  readonly displayName: string;
  /** Whether the provider has the configuration required to connect. */
  isConfigured(): boolean;
}
