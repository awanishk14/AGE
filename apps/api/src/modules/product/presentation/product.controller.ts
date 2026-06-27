import { Controller } from '@nestjs/common';
import { ProductService } from '../application/product.service';

/**
 * ProductController — presentation boundary for the product domain.
 * Placeholder; no routes defined yet.
 */
@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  /** Placeholder. Surfaces module status; replaced during implementation. */
  status(): string {
    return this.productService.status();
  }
}
