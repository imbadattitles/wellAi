import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { KnowledgeConfig } from './config/knowledge.config';
import { KNOWLEDGE_CONFIG } from './infrastructure/tokens';
import { ApiExceptionFilter } from './presentation/http/api-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get<KnowledgeConfig>(KNOWLEDGE_CONFIG);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();

  await app.listen(config.port, '0.0.0.0');
}

void bootstrap().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Knowledge service failed'}\n`);
  process.exitCode = 1;
});
