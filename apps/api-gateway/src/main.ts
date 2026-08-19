import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { readPort } from '@wellllai/platform';
import { readKafkaBrokers } from '@wellllai/platform';
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
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'api-gateway-status',
        brokers: readKafkaBrokers(),
      },
      consumer: {
        groupId: process.env.API_GATEWAY_KAFKA_GROUP_ID ?? 'api-gateway-status-v1',
      },
    },
  });
  await app.startAllMicroservices();
  await app.listen(readPort('API_GATEWAY_PORT', 3001));
}

void bootstrap().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'API gateway failed'}\n`);
  process.exitCode = 1;
});
