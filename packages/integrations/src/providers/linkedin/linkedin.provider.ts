import type { IntegrationProvider } from '../../common/integration-provider.interface';

/**
 * LinkedInProvider — LinkedIn integration. Placeholder; performs no API calls.
 */
export class LinkedInProvider implements IntegrationProvider {
  readonly id = 'linkedin';
  readonly displayName = 'LinkedIn';

  isConfigured(): boolean {
    return false;
  }
}
