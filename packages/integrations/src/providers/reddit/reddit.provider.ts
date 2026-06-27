import type { IntegrationProvider } from '../../common/integration-provider.interface';

/**
 * RedditProvider — Reddit integration. Placeholder; performs no API calls.
 */
export class RedditProvider implements IntegrationProvider {
  readonly id = 'reddit';
  readonly displayName = 'Reddit';

  isConfigured(): boolean {
    return false;
  }
}
