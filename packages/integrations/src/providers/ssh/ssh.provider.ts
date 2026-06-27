import type { IntegrationProvider } from '../../common/integration-provider.interface';

/**
 * SshProvider — SSH integration. Placeholder; performs no API calls.
 */
export class SshProvider implements IntegrationProvider {
  readonly id = 'ssh';
  readonly displayName = 'SSH';

  isConfigured(): boolean {
    return false;
  }
}
