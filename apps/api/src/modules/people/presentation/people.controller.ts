import { Controller } from '@nestjs/common';
import { PeopleService } from '../application/people.service';

/**
 * PeopleController — presentation boundary for the people domain.
 * Placeholder; no routes defined yet.
 */
@Controller('people')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  /** Placeholder. Surfaces module status; replaced during implementation. */
  status(): string {
    return this.peopleService.status();
  }
}
