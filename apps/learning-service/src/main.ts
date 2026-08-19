import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { readKafkaBrokers, readPort } from '@wellllai/platform';
import { AppModule } from './app.module';
import { LearningExceptionFilter } from './presentation/learning-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new LearningExceptionFilter());
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'learning',
        brokers: readKafkaBrokers(),
      },
      consumer: { groupId: 'learning-v1' },
    },
  });

  await app.startAllMicroservices();
  await app.listen(readPort('LEARNING_SERVICE_PORT', 3012));
}

void bootstrap().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Learning service failed'}\n`);
  process.exitCode = 1;
});
