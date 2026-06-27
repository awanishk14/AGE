import { describe, expect, it } from 'vitest';
import { ResearchService } from '../application/research.service';

describe('ResearchModule', () => {
  it('service returns a placeholder status', () => {
    expect(new ResearchService().status()).toContain('research');
  });
});
