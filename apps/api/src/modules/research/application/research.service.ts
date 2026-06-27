import { Injectable } from '@nestjs/common';

/**
 * ResearchService — application service (use-cases) for the research domain.
 * Placeholder; no business logic yet.
 */
@Injectable()
export class ResearchService {
  /** Placeholder status indicator for the scaffolded research module. */
  status(): string {
    return 'research module: scaffold only';
  }
}
