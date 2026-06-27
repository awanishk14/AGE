import type { IntegrationProvider } from '../../common/integration-provider.interface';

/**
 * MetaProvider — Meta integration. Placeholder; performs no API calls.
 */
export class MetaProvider implements IntegrationProvider {
  readonly id = 'meta';
  readonly displayName = 'Meta';

  isConfigured(): boolean {
    return false;
  }
}
