import { Module } from '@nestjs/common';
import { IcpController } from './presentation/icp.controller';
import { IcpService } from './application/icp.service';

/**
 * IcpModule — domain module for the icp bounded context.
 * Scaffold only. No business logic, persistence or routes are implemented yet.
 */
@Module({
  controllers: [IcpController],
  providers: [IcpService],
  exports: [IcpService],
})
export class IcpModule {}
