import type { IntegrationProvider } from '../../common/integration-provider.interface';

/**
 * SearchConsoleProvider — Google Search Console integration. Placeholder; performs no API calls.
 */
export class SearchConsoleProvider implements IntegrationProvider {
  readonly id = 'search-console';
  readonly displayName = 'Google Search Console';

  isConfigured(): boolean {
    return false;
  }
}
