import { Injectable } from '@nestjs/common';

/**
 * KnowledgeService — application service (use-cases) for the knowledge domain.
 * Placeholder; no business logic yet.
 */
@Injectable()
export class KnowledgeService {
  /** Placeholder status indicator for the scaffolded knowledge module. */
  status(): string {
    return 'knowledge module: scaffold only';
  }
}
