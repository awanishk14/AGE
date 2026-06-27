import { describe, expect, it } from 'vitest';
import { ProblemService } from '../application/problem.service';

describe('ProblemModule', () => {
  it('service returns a placeholder status', () => {
    expect(new ProblemService().status()).toContain('problem');
  });
});
