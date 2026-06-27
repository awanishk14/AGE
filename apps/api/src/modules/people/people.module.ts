import { Module } from '@nestjs/common';
import { PeopleController } from './presentation/people.controller';
import { PeopleService } from './application/people.service';

/**
 * PeopleModule — domain module for the people bounded context.
 * Scaffold only. No business logic, persistence or routes are implemented yet.
 */
@Module({
  controllers: [PeopleController],
  providers: [PeopleService],
  exports: [PeopleService],
})
export class PeopleModule {}
