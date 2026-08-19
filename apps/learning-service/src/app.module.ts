import { Module } from '@nestjs/common';
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
import { KnowledgeHttpClient } from './infrastructure/knowledge-http.client';
import { OpenAiLearningAdapter } from './infrastructure/openai-learning.adapter';
import { OutboxRelayService } from './infrastructure/outbox-relay.service';
import { PgLearningRepository } from './infrastructure/pg-learning.repository';
import { PostgresLifecycleService } from './infrastructure/postgres-lifecycle.service';
import { KnowledgeEventsController } from './presentation/knowledge-events.controller';
import { LearningController } from './presentation/learning.controller';

@Module({
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
    { provide: KNOWLEDGE_RETRIEVAL, useClass: KnowledgeHttpClient },
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
