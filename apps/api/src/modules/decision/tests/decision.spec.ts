import { describe, expect, it } from 'vitest';
import { DecisionService } from '../application/decision.service';

describe('DecisionModule', () => {
  it('service returns a placeholder status', () => {
    expect(new DecisionService().status()).toContain('decision');
  });
});
