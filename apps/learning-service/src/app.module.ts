import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KNOWLEDGE_GRPC_PACKAGE, KNOWLEDGE_GRPC_PROTO_PATH } from '@wellllai/contracts';
import { Pool } from 'pg';
import { createPostgresPool } from '@wellllai/platform';
import { LearningApplicationService } from './application/learning.service';
import {
  KNOWLEDGE_RETRIEVAL,
  KnowledgeRetrievalPort,
  LEARNING_AI,
  LEARNING_REPOSITORY,
  LearningAiPort,
  LearningRepository,
  POSTGRES_POOL,
} from './application/ports';
import { KNOWLEDGE_GRPC_CLIENT, KnowledgeGrpcClient } from './infrastructure/knowledge-grpc.client';
import { OpenAiLearningAdapter } from './infrastructure/openai-learning.adapter';
import { OutboxRelayService } from './infrastructure/outbox-relay.service';
import { PgLearningRepository } from './infrastructure/pg-learning.repository';
import { PostgresLifecycleService } from './infrastructure/postgres-lifecycle.service';
import { KnowledgeEventsController } from './presentation/knowledge-events.controller';
import { LearningController } from './presentation/learning.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: KNOWLEDGE_GRPC_CLIENT,
        transport: Transport.GRPC,
        options: {
          package: KNOWLEDGE_GRPC_PACKAGE,
          protoPath: KNOWLEDGE_GRPC_PROTO_PATH,
          url: process.env.KNOWLEDGE_GRPC_URL ?? 'localhost:4011',
          loader: { keepCase: false, defaults: false },
        },
      },
    ]),
  ],
  controllers: [LearningController, KnowledgeEventsController],
  providers: [
    OutboxRelayService,
    PostgresLifecycleService,
    {
      provide: POSTGRES_POOL,
      useFactory: () =>
        createPostgresPool(
          process.env.DATABASE_URL ?? 'postgresql://wellllai:wellllai@localhost:5432/wellllai',
          'learning-service',
        ),
    },
    {
      provide: LEARNING_REPOSITORY,
      inject: [POSTGRES_POOL],
      useFactory: (pool: Pool) => new PgLearningRepository(pool),
    },
    { provide: KNOWLEDGE_RETRIEVAL, useClass: KnowledgeGrpcClient },
    {
      provide: LEARNING_AI,
      useFactory: () => {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('OPENAI_API_KEY is required');
        return new OpenAiLearningAdapter(apiKey, process.env.OPENAI_TEXT_MODEL ?? 'gpt-5.6-terra');
      },
    },
    {
      provide: LearningApplicationService,
      inject: [LEARNING_REPOSITORY, KNOWLEDGE_RETRIEVAL, LEARNING_AI],
      useFactory: (
        repository: LearningRepository,
        knowledge: KnowledgeRetrievalPort,
        ai: LearningAiPort,
      ) => new LearningApplicationService(repository, knowledge, ai),
    },
  ],
})
export class AppModule {}
