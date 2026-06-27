import { Injectable } from '@nestjs/common';

/**
 * ContentService — application service (use-cases) for the content domain.
 * Placeholder; no business logic yet.
 */
@Injectable()
export class ContentService {
  /** Placeholder status indicator for the scaffolded content module. */
  status(): string {
    return 'content module: scaffold only';
  }
}
