import type { IntegrationProvider } from '../../common/integration-provider.interface';

/**
 * GoogleAdsProvider — Google Ads integration. Placeholder; performs no API calls.
 */
export class GoogleAdsProvider implements IntegrationProvider {
  readonly id = 'google-ads';
  readonly displayName = 'Google Ads';

  isConfigured(): boolean {
    return false;
  }
}
