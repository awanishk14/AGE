import { Injectable } from '@nestjs/common';

/**
 * ServiceService — application service (use-cases) for the service domain.
 * Placeholder; no business logic yet.
 */
@Injectable()
export class ServiceService {
  /** Placeholder status indicator for the scaffolded service module. */
  status(): string {
    return 'service module: scaffold only';
  }
}
