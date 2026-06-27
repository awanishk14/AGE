import { Injectable } from '@nestjs/common';

/**
 * PeopleService — application service (use-cases) for the people domain.
 * Placeholder; no business logic yet.
 */
@Injectable()
export class PeopleService {
  /** Placeholder status indicator for the scaffolded people module. */
  status(): string {
    return 'people module: scaffold only';
  }
}
