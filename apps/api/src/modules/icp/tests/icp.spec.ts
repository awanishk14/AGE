import { describe, expect, it } from 'vitest';
import { IcpService } from '../application/icp.service';

describe('IcpModule', () => {
  it('service returns a placeholder status', () => {
    expect(new IcpService().status()).toContain('icp');
  });
});
