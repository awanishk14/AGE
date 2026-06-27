import type { IntegrationProvider } from '../../common/integration-provider.interface';

/**
 * GoogleProvider — Google integration. Placeholder; performs no API calls.
 */
export class GoogleProvider implements IntegrationProvider {
  readonly id = 'google';
  readonly displayName = 'Google';

  isConfigured(): boolean {
    return false;
  }
}
