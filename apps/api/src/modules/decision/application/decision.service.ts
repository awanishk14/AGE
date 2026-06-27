import { Injectable } from '@nestjs/common';

/**
 * DecisionService — application service (use-cases) for the decision domain.
 * Placeholder; no business logic yet.
 */
@Injectable()
export class DecisionService {
  /** Placeholder status indicator for the scaffolded decision module. */
  status(): string {
    return 'decision module: scaffold only';
  }
}
