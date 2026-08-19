import {
  createEnvelope,
  InterviewJobFailed,
  InterviewJobRequested,
  InterviewReportReady,
  InterviewScenarioReady,
  InterviewSessionCompleted,
  KafkaTopics,
  MessageTypes,
} from '@wellllai/contracts';
import { addToOutbox, consumeOnce, inTransaction } from '@wellllai/platform';
import { randomUUID } from 'node:crypto';
import { Pool, PoolClient } from 'pg';
import {
  InterviewReport,
  InterviewReportStatus,
  InterviewScenario,
  InterviewSession,
  InterviewStateError,
  InterviewStatus,
  InterviewTurn,
} from '../domain/interview-session';
import { CreateInterviewSessionInput, InterviewRepository } from '../application/ports';

interface SessionRow {
  id: string;
  user_id: string;
  profession: string;
  level: InterviewSession['level'];
  format: InterviewSession['format'];
  technologies: string[];
  vacancy_text: string | null;
  language: string;
  status: InterviewStatus;
  report_status: InterviewReportStatus;
  scenario: InterviewScenario | null;
  report: InterviewReport | null;
  failure_code: string | null;
  correlation_id: string;
  created_at: Date;
  updated_at: Date;
}

interface TurnRow {
  id: string;
  answer_id: string;
  question_index: number;
  question: string;
  answer: string;
  feedback: string;
  score: number;
  strengths: string[];
  gaps: string[];
  created_at: Date;
}

export class PgInterviewRepository implements InterviewRepository {
  constructor(private readonly pool: Pool) {}

  async createSession(input: CreateInterviewSessionInput): Promise<InterviewSession> {
    const command = createEnvelope<InterviewJobRequested>({
      messageType: MessageTypes.interviewScenarioGenerationRequested,
      producer: 'interview-service',
      aggregateId: input.id,
      correlationId: input.correlationId,
      payload: { sessionId: input.id },
    });

    await inTransaction(this.pool, async (client) => {
      await client.query(
        `INSERT INTO interview.sessions
          (id, user_id, profession, level, format, technologies, vacancy_text, language,
           status, report_status, correlation_id)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8,
                 'scenario_pending', 'not_requested', $9)`,
        [
          input.id,
          input.userId,
          input.profession,
          input.level,
          input.format,
          JSON.stringify(input.technologies),
          input.vacancyText,
          input.language,
          input.correlationId,
        ],
      );
      await addToOutbox(client, 'interview', KafkaTopics.interviewCommands, input.id, command);
    });

    const session = await this.findOwnedSession(input.id, input.userId);
    if (!session) throw new Error('Interview session was not persisted');
    return session;
  }

  findOwnedSession(sessionId: string, userId: string): Promise<InterviewSession | null> {
    return this.loadSession(sessionId, userId);
  }

  findSession(sessionId: string): Promise<InterviewSession | null> {
    return this.loadSession(sessionId, null);
  }

  async isMessageProcessed(messageId: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM interview.inbox_messages WHERE message_id = $1',
      [messageId],
    );
    return result.rowCount === 1;
  }

  async acknowledgeMessage(messageId: string): Promise<void> {
    await consumeOnce(this.pool, 'interview', messageId, async () => undefined);
  }

  async completeScenarioGeneration(
    input: Parameters<InterviewRepository['completeScenarioGeneration']>[0],
  ): Promise<void> {
    await consumeOnce(this.pool, 'interview', input.context.messageId, async (client) => {
      const update = await client.query(
        `UPDATE interview.sessions
            SET scenario = $2::jsonb, status = 'active', failure_code = NULL, updated_at = NOW()
          WHERE id = $1 AND status = 'scenario_pending'
          RETURNING id`,
        [input.sessionId, JSON.stringify(input.scenario)],
      );
      if (update.rowCount !== 1) {
        throw new InterviewStateError('Interview scenario cannot be activated');
      }

      const event = createEnvelope<InterviewScenarioReady>({
        messageType: MessageTypes.interviewScenarioReady,
        producer: 'interview-service',
        aggregateId: input.sessionId,
        correlationId: input.context.correlationId,
        causationId: input.context.messageId,
        payload: {
          sessionId: input.sessionId,
          questionCount: input.scenario.questions.length,
        },
      });
      await addToOutbox(client, 'interview', KafkaTopics.interviewEvents, input.sessionId, event);
    });
  }

  async failScenarioGeneration(
    input: Parameters<InterviewRepository['failScenarioGeneration']>[0],
  ): Promise<void> {
    await consumeOnce(this.pool, 'interview', input.context.messageId, async (client) => {
      const update = await client.query(
        `UPDATE interview.sessions
            SET status = 'failed', failure_code = $2, updated_at = NOW()
          WHERE id = $1 AND status = 'scenario_pending'
          RETURNING id`,
        [input.sessionId, input.failureCode],
      );
      if (update.rowCount !== 1) {
        throw new InterviewStateError('Interview scenario failure cannot be stored');
      }

      const event = createEnvelope<InterviewJobFailed>({
        messageType: MessageTypes.interviewScenarioGenerationFailed,
        producer: 'interview-service',
        aggregateId: input.sessionId,
        correlationId: input.context.correlationId,
        causationId: input.context.messageId,
        payload: {
          sessionId: input.sessionId,
          failureCode: input.failureCode,
        },
      });
      await addToOutbox(client, 'interview', KafkaTopics.interviewEvents, input.sessionId, event);
    });
  }

  async recordAnswer(
    input: Parameters<InterviewRepository['recordAnswer']>[0],
  ): Promise<InterviewTurn> {
    return inTransaction(this.pool, async (client) => {
      const sessionResult = await client.query<{
        status: InterviewStatus;
        correlation_id: string;
      }>(
        `SELECT status, correlation_id
           FROM interview.sessions
          WHERE id = $1 AND user_id = $2
          FOR UPDATE`,
        [input.sessionId, input.userId],
      );
      const session = sessionResult.rows[0];
      if (!session) throw new InterviewStateError('Interview session is no longer available');

      const priorSubmission = await client.query<TurnRow>(
        `SELECT * FROM interview.turns
          WHERE session_id = $1 AND answer_id = $2`,
        [input.sessionId, input.answerId],
      );
      const priorTurn = priorSubmission.rows[0];
      if (priorTurn) {
        if (
          priorTurn.question_index !== input.expectedQuestionIndex ||
          priorTurn.answer !== input.answer
        ) {
          throw new InterviewStateError('answerId was already used for another submission');
        }
        return this.mapTurn(priorTurn);
      }

      if (session.status !== 'active') {
        throw new InterviewStateError(`Interview session is ${session.status}`);
      }

      const turnCountResult = await client.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM interview.turns WHERE session_id = $1',
        [input.sessionId],
      );
      const persistedTurnCount = Number(turnCountResult.rows[0]?.count ?? 0);
      if (persistedTurnCount !== input.expectedQuestionIndex) {
        throw new InterviewStateError('This interview question was already answered');
      }

      const turn: InterviewTurn = {
        id: randomUUID(),
        answerId: input.answerId,
        questionIndex: input.expectedQuestionIndex,
        question: input.question,
        answer: input.answer,
        feedback: input.evaluation.feedback,
        score: input.evaluation.score,
        strengths: input.evaluation.strengths,
        gaps: input.evaluation.gaps,
        createdAt: new Date(),
      };
      await this.insertTurn(client, input.sessionId, turn);

      await client.query(
        `UPDATE interview.sessions
            SET status = $2,
                report_status = CASE WHEN $3 THEN 'pending' ELSE report_status END,
                updated_at = NOW()
          WHERE id = $1`,
        [input.sessionId, input.completed ? 'completed' : 'active', input.completed],
      );

      if (input.completed) {
        await this.enqueueCompletion(client, {
          sessionId: input.sessionId,
          userId: input.userId,
          correlationId: session.correlation_id,
        });
      }

      return turn;
    });
  }

  async completeReportGeneration(
    input: Parameters<InterviewRepository['completeReportGeneration']>[0],
  ): Promise<void> {
    await consumeOnce(this.pool, 'interview', input.context.messageId, async (client) => {
      const update = await client.query(
        `UPDATE interview.sessions
            SET report = $2::jsonb, report_status = 'ready', failure_code = NULL,
                updated_at = NOW()
          WHERE id = $1 AND status = 'completed' AND report_status = 'pending'
          RETURNING id`,
        [input.sessionId, JSON.stringify(input.report)],
      );
      if (update.rowCount !== 1) {
        throw new InterviewStateError('Interview report cannot be stored');
      }

      const event = createEnvelope<InterviewReportReady>({
        messageType: MessageTypes.interviewReportReady,
        producer: 'interview-service',
        aggregateId: input.sessionId,
        correlationId: input.context.correlationId,
        causationId: input.context.messageId,
        payload: {
          sessionId: input.sessionId,
          overallScore: input.report.overallScore,
        },
      });
      await addToOutbox(client, 'interview', KafkaTopics.interviewEvents, input.sessionId, event);
    });
  }

  async failReportGeneration(
    input: Parameters<InterviewRepository['failReportGeneration']>[0],
  ): Promise<void> {
    await consumeOnce(this.pool, 'interview', input.context.messageId, async (client) => {
      const update = await client.query(
        `UPDATE interview.sessions
            SET report_status = 'failed', failure_code = $2, updated_at = NOW()
          WHERE id = $1 AND status = 'completed' AND report_status = 'pending'
          RETURNING id`,
        [input.sessionId, input.failureCode],
      );
      if (update.rowCount !== 1) {
        throw new InterviewStateError('Interview report failure cannot be stored');
      }

      const event = createEnvelope<InterviewJobFailed>({
        messageType: MessageTypes.interviewReportGenerationFailed,
        producer: 'interview-service',
        aggregateId: input.sessionId,
        correlationId: input.context.correlationId,
        causationId: input.context.messageId,
        payload: {
          sessionId: input.sessionId,
          failureCode: input.failureCode,
        },
      });
      await addToOutbox(client, 'interview', KafkaTopics.interviewEvents, input.sessionId, event);
    });
  }

  private async loadSession(
    sessionId: string,
    userId: string | null,
  ): Promise<InterviewSession | null> {
    const sessionResult = userId
      ? await this.pool.query<SessionRow>(
          'SELECT * FROM interview.sessions WHERE id = $1 AND user_id = $2',
          [sessionId, userId],
        )
      : await this.pool.query<SessionRow>('SELECT * FROM interview.sessions WHERE id = $1', [
          sessionId,
        ]);
    const row = sessionResult.rows[0];
    if (!row) return null;

    const turnsResult = await this.pool.query<TurnRow>(
      `SELECT * FROM interview.turns
        WHERE session_id = $1
        ORDER BY question_index`,
      [sessionId],
    );
    return this.mapSession(
      row,
      turnsResult.rows.map((turn) => this.mapTurn(turn)),
    );
  }

  private async insertTurn(
    client: PoolClient,
    sessionId: string,
    turn: InterviewTurn,
  ): Promise<void> {
    await client.query(
      `INSERT INTO interview.turns
        (id, session_id, answer_id, question_index, question, answer, feedback, score,
         strengths, gaps, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11)`,
      [
        turn.id,
        sessionId,
        turn.answerId,
        turn.questionIndex,
        turn.question,
        turn.answer,
        turn.feedback,
        turn.score,
        JSON.stringify(turn.strengths),
        JSON.stringify(turn.gaps),
        turn.createdAt,
      ],
    );
  }

  private async enqueueCompletion(
    client: PoolClient,
    input: { sessionId: string; userId: string; correlationId: string },
  ): Promise<void> {
    const completedEvent = createEnvelope<InterviewSessionCompleted>({
      messageType: MessageTypes.interviewSessionCompleted,
      producer: 'interview-service',
      aggregateId: input.sessionId,
      correlationId: input.correlationId,
      payload: { sessionId: input.sessionId, userId: input.userId },
    });
    const reportCommand = createEnvelope<InterviewJobRequested>({
      messageType: MessageTypes.interviewReportGenerationRequested,
      producer: 'interview-service',
      aggregateId: input.sessionId,
      correlationId: input.correlationId,
      causationId: completedEvent.messageId,
      payload: { sessionId: input.sessionId },
    });

    await addToOutbox(
      client,
      'interview',
      KafkaTopics.interviewEvents,
      input.sessionId,
      completedEvent,
    );
    await addToOutbox(
      client,
      'interview',
      KafkaTopics.interviewCommands,
      input.sessionId,
      reportCommand,
    );
  }

  private mapSession(row: SessionRow, turns: InterviewTurn[]): InterviewSession {
    return {
      id: row.id,
      userId: row.user_id,
      profession: row.profession,
      level: row.level,
      format: row.format,
      technologies: row.technologies,
      vacancyText: row.vacancy_text,
      language: row.language,
      status: row.status,
      reportStatus: row.report_status,
      scenario: row.scenario,
      report: row.report,
      turns,
      failureCode: row.failure_code,
      correlationId: row.correlation_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapTurn(row: TurnRow): InterviewTurn {
    return {
      id: row.id,
      answerId: row.answer_id,
      questionIndex: row.question_index,
      question: row.question,
      answer: row.answer,
      feedback: row.feedback,
      score: Number(row.score),
      strengths: row.strengths,
      gaps: row.gaps,
      createdAt: row.created_at,
    };
  }
}
