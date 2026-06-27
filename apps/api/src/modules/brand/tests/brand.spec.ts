import { describe, expect, it } from 'vitest';
import { BrandService } from '../application/brand.service';

describe('BrandModule', () => {
  it('service returns a placeholder status', () => {
    expect(new BrandService().status()).toContain('brand');
  });
});
