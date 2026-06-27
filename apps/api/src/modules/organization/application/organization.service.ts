import { Injectable } from '@nestjs/common';

/**
 * OrganizationService — application service (use-cases) for the organization domain.
 * Placeholder; no business logic yet.
 */
@Injectable()
export class OrganizationService {
  /** Placeholder status indicator for the scaffolded organization module. */
  status(): string {
    return 'organization module: scaffold only';
  }
}
