import type { IntegrationProvider } from '../../common/integration-provider.interface';

/**
 * GitHubProvider — GitHub integration. Placeholder; performs no API calls.
 */
export class GitHubProvider implements IntegrationProvider {
  readonly id = 'github';
  readonly displayName = 'GitHub';

  isConfigured(): boolean {
    return false;
  }
}
