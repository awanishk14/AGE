import { describe, expect, it } from 'vitest';
import { StrategyService } from '../application/strategy.service';

describe('StrategyModule', () => {
  it('service returns a placeholder status', () => {
    expect(new StrategyService().status()).toContain('strategy');
  });
});
