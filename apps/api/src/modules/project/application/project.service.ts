import { Injectable } from '@nestjs/common';

/**
 * ProjectService — application service (use-cases) for the project domain.
 * Placeholder; no business logic yet.
 */
@Injectable()
export class ProjectService {
  /** Placeholder status indicator for the scaffolded project module. */
  status(): string {
    return 'project module: scaffold only';
  }
}
