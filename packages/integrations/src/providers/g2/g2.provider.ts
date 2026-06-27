import type { IntegrationProvider } from '../../common/integration-provider.interface';

/**
 * G2Provider — G2 integration. Placeholder; performs no API calls.
 */
export class G2Provider implements IntegrationProvider {
  readonly id = 'g2';
  readonly displayName = 'G2';

  isConfigured(): boolean {
    return false;
  }
}
