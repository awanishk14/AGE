import { Module } from '@nestjs/common';
import { IntegrationController } from './presentation/integration.controller';
import { IntegrationService } from './application/integration.service';

/**
 * IntegrationModule — domain module for the integration bounded context.
 * Scaffold only. No business logic, persistence or routes are implemented yet.
 */
@Module({
  controllers: [IntegrationController],
  providers: [IntegrationService],
  exports: [IntegrationService],
})
export class IntegrationModule {}
