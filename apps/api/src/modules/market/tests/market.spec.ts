import { describe, expect, it } from 'vitest';
import { MarketService } from '../application/market.service';

describe('MarketModule', () => {
  it('service returns a placeholder status', () => {
    expect(new MarketService().status()).toContain('market');
  });
});
