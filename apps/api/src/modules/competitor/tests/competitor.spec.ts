import { describe, expect, it } from 'vitest';
import { CompetitorService } from '../application/competitor.service';

describe('CompetitorModule', () => {
  it('service returns a placeholder status', () => {
    expect(new CompetitorService().status()).toContain('competitor');
  });
});
