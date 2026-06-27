import type { IntegrationProvider } from '../../common/integration-provider.interface';

/**
 * YouTubeProvider — YouTube integration. Placeholder; performs no API calls.
 */
export class YouTubeProvider implements IntegrationProvider {
  readonly id = 'youtube';
  readonly displayName = 'YouTube';

  isConfigured(): boolean {
    return false;
  }
}
