import { describe, expect, it } from 'vitest';
import { ProductService } from '../application/product.service';

describe('ProductModule', () => {
  it('service returns a placeholder status', () => {
    expect(new ProductService().status()).toContain('product');
  });
});
