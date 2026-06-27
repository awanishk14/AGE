import { Injectable } from '@nestjs/common';

/**
 * IntegrationService — application service (use-cases) for the integration domain.
 * Placeholder; no business logic yet.
 */
@Injectable()
export class IntegrationService {
  /** Placeholder status indicator for the scaffolded integration module. */
  status(): string {
    return 'integration module: scaffold only';
  }
}
