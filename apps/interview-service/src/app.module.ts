import { Module } from '@nestjs/common';
import { createPostgresPool } from '@wellllai/platform';
import { Pool } from 'pg';
import { InterviewJobsService } from './application/interview-jobs.service';
import { InterviewApplicationService } from './application/interview.service';
import {
  INTERVIEW_AI,
  INTERVIEW_REPOSITORY,
  InterviewAiPort,
  InterviewRepository,
  POSTGRES_POOL,
} from './application/ports';
import { DatabaseLifecycleService } from './infrastructure/database-lifecycle.service';
import { OpenAiInterviewAdapter } from './infrastructure/openai-interview.adapter';
import { OutboxRelayService } from './infrastructure/outbox-relay.service';
import { PgInterviewRepository } from './infrastructure/pg-interview.repository';
import { InterviewCommandsController } from './presentation/interview-commands.controller';
import { InterviewController } from './presentation/interview.controller';

@Module({
  controllers: [InterviewController, InterviewCommandsController],
  providers: [
    OutboxRelayService,
    DatabaseLifecycleService,
    {
      provide: POSTGRES_POOL,
      useFactory: () =>
        createPostgresPool(
          process.env.DATABASE_URL ?? 'postgresql://wellllai:wellllai@localhost:5432/wellllai',
          'interview-service',
        ),
    },
    {
      provide: INTERVIEW_REPOSITORY,
      inject: [POSTGRES_POOL],
      useFactory: (pool: Pool) => new PgInterviewRepository(pool),
    },
    {
      provide: INTERVIEW_AI,
      useFactory: () => {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('OPENAI_API_KEY is required');
        return new OpenAiInterviewAdapter(apiKey, process.env.OPENAI_TEXT_MODEL ?? 'gpt-5.6-terra');
      },
    },
    {
      provide: InterviewApplicationService,
      inject: [INTERVIEW_REPOSITORY, INTERVIEW_AI],
      useFactory: (repository: InterviewRepository, ai: InterviewAiPort) =>
        new InterviewApplicationService(repository, ai),
    },
    {
      provide: InterviewJobsService,
      inject: [INTERVIEW_REPOSITORY, INTERVIEW_AI],
      useFactory: (repository: InterviewRepository, ai: InterviewAiPort) =>
        new InterviewJobsService(repository, ai),
    },
  ],
})
export class AppModule {}
