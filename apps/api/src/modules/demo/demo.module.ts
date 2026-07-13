import { Module } from '@nestjs/common';
import { DemoController } from './presentation/demo.controller';
import { DemoService } from './application/demo.service';

/**
 * DemoModule — read-only bounded context exposing the in-memory capability demo.
 *
 * Delegates all logic to the shared `@age/demo-runtime`; introduces no
 * persistence, integrations, queues, events, or execution behaviour.
 */
@Module({
  controllers: [DemoController],
  providers: [DemoService],
  exports: [DemoService],
})
export class DemoModule {}
