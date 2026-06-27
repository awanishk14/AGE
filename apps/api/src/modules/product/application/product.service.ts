import { Injectable } from '@nestjs/common';

/**
 * ProductService — application service (use-cases) for the product domain.
 * Placeholder; no business logic yet.
 */
@Injectable()
export class ProductService {
  /** Placeholder status indicator for the scaffolded product module. */
  status(): string {
    return 'product module: scaffold only';
  }
}
