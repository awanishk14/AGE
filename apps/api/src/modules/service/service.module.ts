import { Module } from '@nestjs/common';
import { ServiceController } from './presentation/service.controller';
import { ServiceService } from './application/service.service';

/**
 * ServiceModule — domain module for the service bounded context.
 * Scaffold only. No business logic, persistence or routes are implemented yet.
 */
@Module({
  controllers: [ServiceController],
  providers: [ServiceService],
  exports: [ServiceService],
})
export class ServiceModule {}
