import { describe, expect, it } from 'vitest';
import { EvidenceService } from '../application/evidence.service';

describe('EvidenceModule', () => {
  it('service returns a placeholder status', () => {
    expect(new EvidenceService().status()).toContain('evidence');
  });
});
