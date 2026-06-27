import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DOMAIN_MODULES } from './modules';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ...DOMAIN_MODULES],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
