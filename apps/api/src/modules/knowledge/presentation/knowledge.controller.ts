import { Controller } from '@nestjs/common';
import { KnowledgeService } from '../application/knowledge.service';

/**
 * KnowledgeController — presentation boundary for the knowledge domain.
 * Placeholder; no routes defined yet.
 */
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  /** Placeholder. Surfaces module status; replaced during implementation. */
  status(): string {
    return this.knowledgeService.status();
  }
}
