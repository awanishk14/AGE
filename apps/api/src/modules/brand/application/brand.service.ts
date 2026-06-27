import { Injectable } from '@nestjs/common';

/**
 * BrandService — application service (use-cases) for the brand domain.
 * Placeholder; no business logic yet.
 */
@Injectable()
export class BrandService {
  /** Placeholder status indicator for the scaffolded brand module. */
  status(): string {
    return 'brand module: scaffold only';
  }
}
