import { Module } from '@nestjs/common';
import { EvidenceController } from './presentation/evidence.controller';
import { EvidenceService } from './application/evidence.service';

/**
 * EvidenceModule — domain module for the evidence bounded context.
 * Scaffold only. No business logic, persistence or routes are implemented yet.
 */
@Module({
  controllers: [EvidenceController],
  providers: [EvidenceService],
  exports: [EvidenceService],
})
export class EvidenceModule {}
