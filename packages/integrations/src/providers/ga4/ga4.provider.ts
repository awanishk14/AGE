import type { IntegrationProvider } from '../../common/integration-provider.interface';

/**
 * Ga4Provider — Google Analytics 4 integration. Placeholder; performs no API calls.
 */
export class Ga4Provider implements IntegrationProvider {
  readonly id = 'ga4';
  readonly displayName = 'Google Analytics 4';

  isConfigured(): boolean {
    return false;
  }
}
