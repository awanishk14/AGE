import type { IntegrationProvider } from '../../common/integration-provider.interface';

/**
 * TrustpilotProvider — Trustpilot integration. Placeholder; performs no API calls.
 */
export class TrustpilotProvider implements IntegrationProvider {
  readonly id = 'trustpilot';
  readonly displayName = 'Trustpilot';

  isConfigured(): boolean {
    return false;
  }
}
