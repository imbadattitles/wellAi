import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import {
  createEnvelope,
  KafkaTopics,
  MessageTypes,
  TopicMaterializationRequested,
} from '@wellllai/contracts';
import { addToOutbox, consumeOnce, inTransaction } from '@wellllai/platform';
import {
  CreateDocumentProgramInput,
  CreateTopicProgramInput,
  LearningProgram,
  LearningRepository,
  PersistedQuestion,
} from '../application/ports';

interface ProgramRow {
  id: string;
  user_id: string;
  source_id: string;
  source_type: 'document' | 'generated_topic';
  title: string;
  goal: string;
  level: LearningProgram['level'];
  language: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  failure_code: string | null;
  knowledge_version_id: string | null;
  created_at: Date;
}

export class PgLearningRepository implements LearningRepository {
  constructor(private readonly pool: Pool) {}

  async createTopicProgram(input: CreateTopicProgramInput): Promise<LearningProgram> {
    const programId = randomUUID();
    const sourceId = randomUUID();
    const envelope = createEnvelope<TopicMaterializationRequested>({
      messageType: MessageTypes.knowledgeTopicMaterializationRequested,
      producer: 'learning-service',
      aggregateId: sourceId,
      correlationId: input.correlationId,
      payload: {
        sourceId,
        programId,
        userId: input.userId,
        topic: input.topic,
        goal: input.goal,
        level: input.level,
        language: input.language,
      },
    });

    await inTransaction(this.pool, async (client) => {
      await client.query(
        `INSERT INTO learning.programs
          (id, user_id, source_id, source_type, title, goal, level, language, status)
         VALUES ($1, $2, $3, 'generated_topic', $4, $5, $6, $7, 'processing')`,
        [programId, input.userId, sourceId, input.topic, input.goal, input.level, input.language],
      );
      await addToOutbox(client, 'learning', KafkaTopics.knowledgeCommands, sourceId, envelope);
    });

    return this.requireProgram(programId, input.userId);
  }

  async createDocumentProgram(input: CreateDocumentProgramInput): Promise<LearningProgram> {
    const programId = randomUUID();
    const sourceId = randomUUID();
    await this.pool.query(
      `INSERT INTO learning.programs
        (id, user_id, source_id, source_type, title, goal, level, language, status)
       VALUES ($1, $2, $3, 'document', $4, '', 'unspecified', $5, 'pending')`,
      [programId, input.userId, sourceId, input.title, input.language],
    );
    return this.requireProgram(programId, input.userId);
  }

  async markDocumentUploadFailed(
    input: Parameters<LearningRepository['markDocumentUploadFailed']>[0],
  ): Promise<LearningProgram | null> {
    const result = await this.pool.query<ProgramRow>(
      `UPDATE learning.programs
          SET status = 'failed', failure_code = $4, updated_at = NOW()
        WHERE id = $1
          AND source_id = $2
          AND user_id = $3
          AND source_type = 'document'
          AND status <> 'ready'
      RETURNING *`,
      [input.programId, input.sourceId, input.userId, input.errorCode],
    );
    return result.rows[0] ? this.mapProgram(result.rows[0]) : null;
  }

  async findOwnedProgram(programId: string, userId: string): Promise<LearningProgram | null> {
    const result = await this.pool.query<ProgramRow>(
      'SELECT * FROM learning.programs WHERE id = $1 AND user_id = $2',
      [programId, userId],
    );
    return result.rows[0] ? this.mapProgram(result.rows[0]) : null;
  }

  async saveCitedAnswer(input: Parameters<LearningRepository['saveCitedAnswer']>[0]) {
    const id = randomUUID();
    await this.pool.query(
      `INSERT INTO learning.question_answers
        (id, program_id, user_id, question, answer, citations, insufficient_context)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
      [
        id,
        input.programId,
        input.userId,
        input.question,
        input.answer.answer,
        JSON.stringify(input.answer.citations),
        input.answer.insufficientContext,
      ],
    );
    return { id };
  }

  async saveQuiz(input: Parameters<LearningRepository['saveQuiz']>[0]) {
    const quizId = randomUUID();
    const questions = input.questions.map((question) => ({
      ...question,
      id: randomUUID(),
      quizId,
      programId: input.program.id,
      sourceId: input.program.sourceId,
    }));

    await inTransaction(this.pool, async (client) => {
      await client.query(
        `INSERT INTO learning.quizzes (id, program_id, user_id, status)
         VALUES ($1, $2, $3, 'ready')`,
        [quizId, input.program.id, input.program.userId],
      );
      for (const question of questions) {
        await client.query(
          `INSERT INTO learning.questions
            (id, quiz_id, program_id, source_id, type, topic, prompt, options,
             correct_answer, rubric, source_chunk_ids)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::jsonb, $11::uuid[])`,
          [
            question.id,
            quizId,
            question.programId,
            question.sourceId,
            question.type,
            question.topic,
            question.prompt,
            JSON.stringify(question.options),
            question.correctAnswer,
            JSON.stringify(question.rubric),
            question.sourceChunkIds,
          ],
        );
      }
    });
    return { id: quizId, questions };
  }

  async findOwnedQuestion(questionId: string, userId: string): Promise<PersistedQuestion | null> {
    const result = await this.pool.query<{
      id: string;
      quiz_id: string;
      program_id: string;
      source_id: string;
      type: 'single_choice' | 'free_text';
      topic: string;
      prompt: string;
      options: string[] | null;
      correct_answer: string | null;
      rubric: string[];
      source_chunk_ids: string[];
    }>(
      `SELECT q.*
         FROM learning.questions q
         JOIN learning.quizzes z ON z.id = q.quiz_id
        WHERE q.id = $1 AND z.user_id = $2`,
      [questionId, userId],
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          quizId: row.quiz_id,
          programId: row.program_id,
          sourceId: row.source_id,
          type: row.type,
          topic: row.topic,
          prompt: row.prompt,
          options: row.options,
          correctAnswer: row.correct_answer,
          rubric: row.rubric,
          sourceChunkIds: row.source_chunk_ids,
        }
      : null;
  }

  async getProgress(programId: string, userId: string) {
    const result = await this.pool.query<{
      topic: string;
      score: number;
      attempt_count: number;
      last_reviewed_at: Date;
    }>(
      `SELECT m.topic, m.score, m.attempt_count, m.last_reviewed_at
         FROM learning.mastery m
         JOIN learning.programs p ON p.id = m.program_id
        WHERE m.program_id = $1 AND m.user_id = $2 AND p.user_id = $2
        ORDER BY m.score ASC, m.last_reviewed_at ASC`,
      [programId, userId],
    );
    return result.rows.map((row) => ({
      topic: row.topic,
      score: Number(row.score),
      attemptCount: row.attempt_count,
      lastReviewedAt: row.last_reviewed_at,
    }));
  }

  async saveAttempt(input: Parameters<LearningRepository['saveAttempt']>[0]) {
    const attemptId = randomUUID();
    const mastery = await inTransaction(this.pool, async (client) => {
      await client.query(
        `INSERT INTO learning.attempts
          (id, question_id, user_id, answer, score, feedback, missing_points)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
        [
          attemptId,
          input.question.id,
          input.userId,
          input.answer,
          input.evaluation.score,
          input.evaluation.feedback,
          JSON.stringify(input.evaluation.missingPoints),
        ],
      );
      const result = await client.query<{ score: number }>(
        `INSERT INTO learning.mastery
          (user_id, program_id, topic, score, attempt_count, last_reviewed_at)
         VALUES ($1, $2, $3, $4, 1, NOW())
         ON CONFLICT (user_id, program_id, topic)
         DO UPDATE SET
           score = ((learning.mastery.score * learning.mastery.attempt_count) + EXCLUDED.score)
                   / (learning.mastery.attempt_count + 1),
           attempt_count = learning.mastery.attempt_count + 1,
           last_reviewed_at = NOW()
         RETURNING score`,
        [input.userId, input.question.programId, input.question.topic, input.evaluation.score],
      );
      return result.rows[0]?.score ?? input.evaluation.score;
    });
    return { attemptId, mastery: Number(mastery) };
  }

  async markSourceReady(
    context: Parameters<LearningRepository['markSourceReady']>[0],
    payload: { sourceId: string; programId: string; knowledgeVersionId: string },
  ): Promise<void> {
    await consumeOnce(this.pool, 'learning', context.messageId, async (client) => {
      const result = await client.query(
        `UPDATE learning.programs
            SET status = 'ready', knowledge_version_id = $3, failure_code = NULL, updated_at = NOW()
          WHERE id = $1 AND source_id = $2`,
        [payload.programId, payload.sourceId, payload.knowledgeVersionId],
      );
      if (result.rowCount !== 1) return;

      const event = createEnvelope({
        messageType: MessageTypes.learningProgramStatusChanged,
        producer: 'learning-service',
        aggregateId: payload.programId,
        correlationId: context.correlationId,
        causationId: context.messageId,
        traceparent: context.traceparent,
        payload: {
          programId: payload.programId,
          sourceId: payload.sourceId,
          status: 'ready' as const,
          failureCode: null,
        },
      });
      await addToOutbox(client, 'learning', KafkaTopics.learningEvents, payload.programId, event);
    });
  }

  async markSourceFailed(
    context: Parameters<LearningRepository['markSourceFailed']>[0],
    payload: { sourceId: string; programId: string; errorCode: string },
  ): Promise<void> {
    await consumeOnce(this.pool, 'learning', context.messageId, async (client) => {
      const result = await client.query(
        `UPDATE learning.programs
            SET status = 'failed', failure_code = $3, updated_at = NOW()
          WHERE id = $1 AND source_id = $2`,
        [payload.programId, payload.sourceId, payload.errorCode],
      );
      if (result.rowCount !== 1) return;

      const event = createEnvelope({
        messageType: MessageTypes.learningProgramStatusChanged,
        producer: 'learning-service',
        aggregateId: payload.programId,
        correlationId: context.correlationId,
        causationId: context.messageId,
        traceparent: context.traceparent,
        payload: {
          programId: payload.programId,
          sourceId: payload.sourceId,
          status: 'failed' as const,
          failureCode: payload.errorCode,
        },
      });
      await addToOutbox(client, 'learning', KafkaTopics.learningEvents, payload.programId, event);
    });
  }

  private async requireProgram(programId: string, userId: string): Promise<LearningProgram> {
    const program = await this.findOwnedProgram(programId, userId);
    if (!program) throw new Error('Program was not persisted');
    return program;
  }

  private mapProgram(row: ProgramRow): LearningProgram {
    return {
      id: row.id,
      userId: row.user_id,
      sourceId: row.source_id,
      sourceType: row.source_type,
      title: row.title,
      goal: row.goal,
      level: row.level,
      language: row.language,
      status: row.status,
      failureCode: row.failure_code,
      knowledgeVersionId: row.knowledge_version_id,
      createdAt: row.created_at,
    };
  }
}
