import { Controller } from '@nestjs/common';
import { EvidenceService } from '../application/evidence.service';

/**
 * EvidenceController — presentation boundary for the evidence domain.
 * Placeholder; no routes defined yet.
 */
@Controller('evidence')
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  /** Placeholder. Surfaces module status; replaced during implementation. */
  status(): string {
    return this.evidenceService.status();
  }
}
