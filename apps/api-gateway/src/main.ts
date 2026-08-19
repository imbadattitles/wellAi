import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { readPort } from '@wellllai/platform';
import { AppModule } from './app.module';
import { HttpErrorFilter } from './presentation/http-error.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: false,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new HttpErrorFilter());
  await app.listen(readPort('API_GATEWAY_PORT', 3001));
}

void bootstrap().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'API gateway failed'}\n`);
  process.exitCode = 1;
});
