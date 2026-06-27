import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  console.log(`AGE API listening on http://localhost:${port}`);
}

void bootstrap();
