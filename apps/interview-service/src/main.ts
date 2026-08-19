import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { readKafkaBrokers, readPort } from '@wellllai/platform';
import { AppModule } from './app.module';
import { InterviewHttpExceptionFilter } from './presentation/interview-http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new InterviewHttpExceptionFilter());
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'interview',
        brokers: readKafkaBrokers(),
      },
      consumer: { groupId: 'interview-v1' },
    },
  });

  app.enableShutdownHooks();
  await app.startAllMicroservices();
  await app.listen(readPort('INTERVIEW_SERVICE_PORT', 3013));
}

void bootstrap().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Interview service failed'}\n`);
  process.exitCode = 1;
});
