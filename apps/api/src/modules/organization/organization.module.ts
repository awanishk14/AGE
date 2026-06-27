import { Module } from '@nestjs/common';
import { OrganizationController } from './presentation/organization.controller';
import { OrganizationService } from './application/organization.service';

/**
 * OrganizationModule — domain module for the organization bounded context.
 * Scaffold only. No business logic, persistence or routes are implemented yet.
 */
@Module({
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
