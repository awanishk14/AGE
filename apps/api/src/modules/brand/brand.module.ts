import { Module } from '@nestjs/common';
import { BrandController } from './presentation/brand.controller';
import { BrandService } from './application/brand.service';

/**
 * BrandModule — domain module for the brand bounded context.
 * Scaffold only. No business logic, persistence or routes are implemented yet.
 */
@Module({
  controllers: [BrandController],
  providers: [BrandService],
  exports: [BrandService],
})
export class BrandModule {}
