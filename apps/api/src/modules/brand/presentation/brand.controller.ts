import { Controller } from '@nestjs/common';
import { BrandService } from '../application/brand.service';

/**
 * BrandController — presentation boundary for the brand domain.
 * Placeholder; no routes defined yet.
 */
@Controller('brand')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  /** Placeholder. Surfaces module status; replaced during implementation. */
  status(): string {
    return this.brandService.status();
  }
}
