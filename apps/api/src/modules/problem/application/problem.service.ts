import { Injectable } from '@nestjs/common';

/**
 * ProblemService — application service (use-cases) for the problem domain.
 * Placeholder; no business logic yet.
 */
@Injectable()
export class ProblemService {
  /** Placeholder status indicator for the scaffolded problem module. */
  status(): string {
    return 'problem module: scaffold only';
  }
}
