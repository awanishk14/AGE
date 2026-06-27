import { Controller } from '@nestjs/common';
import { ContentService } from '../application/content.service';

/**
 * ContentController — presentation boundary for the content domain.
 * Placeholder; no routes defined yet.
 */
@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  /** Placeholder. Surfaces module status; replaced during implementation. */
  status(): string {
    return this.contentService.status();
  }
}
