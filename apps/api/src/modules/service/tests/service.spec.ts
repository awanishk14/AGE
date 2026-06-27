import { describe, expect, it } from 'vitest';
import { ServiceService } from '../application/service.service';

describe('ServiceModule', () => {
  it('service returns a placeholder status', () => {
    expect(new ServiceService().status()).toContain('service');
  });
});
