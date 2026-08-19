import { randomUUID } from 'node:crypto';
import { CreateTopicProgram } from '@wellllai/contracts';
import {
  LearningAiOutputError,
  LearningMaterialError,
  LearningNotFoundError,
  LearningStateError,
} from '../domain/errors';
import { KnowledgeRetrievalPort, LearningAiPort, LearningRepository } from './ports';
import { keepKnownChunkIds, validateCitedAnswer } from './citation-validator';

export class LearningApplicationService {
  constructor(
    private readonly repository: LearningRepository,
    private readonly knowledge: KnowledgeRetrievalPort,
    private readonly ai: LearningAiPort,
  ) {}

  createTopicProgram(input: {
    userId: string;
    topic: string;
    goal: string;
    level: CreateTopicProgram['level'];
    language: string;
    correlationId?: string;
  }) {
    return this.repository.createTopicProgram({
      ...input,
      correlationId: input.correlationId ?? randomUUID(),
    });
  }

  createDocumentProgram(input: {
    userId: string;
    title: string;
    fileName: string;
    language: string;
  }) {
    return this.repository.createDocumentProgram(input);
  }

  async markDocumentUploadFailed(input: {
    programId: string;
    sourceId: string;
    userId: string;
    errorCode: string;
  }) {
    const program = await this.repository.findOwnedProgram(input.programId, input.userId);
    if (!program || program.sourceType !== 'document' || program.sourceId !== input.sourceId) {
      throw new LearningNotFoundError('Document learning program not found');
    }
    if (program.status === 'ready') return program;

    const updated = await this.repository.markDocumentUploadFailed(input);
    if (updated) return updated;

    const current = await this.repository.findOwnedProgram(input.programId, input.userId);
    if (current?.sourceType === 'document' && current.sourceId === input.sourceId) return current;
    throw new LearningNotFoundError('Document learning program not found');
  }

  async getProgram(programId: string, userId: string) {
    return this.requireReadyOrPendingProgram(programId, userId, false);
  }

  async getProgress(programId: string, userId: string) {
    await this.requireReadyOrPendingProgram(programId, userId, false);
    const topics = await this.repository.getProgress(programId, userId);
    return {
      programId,
      topics,
      weakestTopics: [...topics]
        .sort((left, right) => left.score - right.score)
        .slice(0, 3)
        .map((topic) => topic.topic),
    };
  }

  async answerQuestion(input: {
    programId: string;
    userId: string;
    question: string;
    language: string;
  }) {
    const program = await this.requireReadyOrPendingProgram(input.programId, input.userId, true);
    const chunks = await this.knowledge.retrieve(program.sourceId, input.question, 8);
    if (chunks.length === 0) {
      throw new LearningMaterialError('No relevant material was found');
    }

    const rawAnswer = await this.ai.answerQuestion({
      question: input.question,
      language: input.language,
      chunks,
    });
    const answer = validateCitedAnswer(rawAnswer, chunks);
    const stored = await this.repository.saveCitedAnswer({
      programId: program.id,
      userId: input.userId,
      question: input.question,
      answer,
    });
    return { id: stored.id, ...answer };
  }

  async generateQuiz(input: {
    programId: string;
    userId: string;
    count: number;
    difficulty: 'easy' | 'medium' | 'hard';
    language: string;
  }) {
    const program = await this.requireReadyOrPendingProgram(input.programId, input.userId, true);
    const chunks = await this.knowledge.retrieve(
      program.sourceId,
      `${program.title}. ${program.goal}`,
      16,
    );
    if (chunks.length === 0) {
      throw new LearningMaterialError('There is not enough material for a quiz');
    }

    const generated = await this.ai.generateQuiz({
      title: program.title,
      language: input.language,
      count: input.count,
      difficulty: input.difficulty,
      chunks,
    });
    const questions = generated.map((question) => {
      if (
        question.type === 'single_choice' &&
        (question.options?.length !== 4 ||
          !question.correctAnswer ||
          !question.options.includes(question.correctAnswer))
      ) {
        throw new LearningAiOutputError(
          'Generated single-choice question has inconsistent options',
        );
      }
      if (
        question.type === 'free_text' &&
        (question.options !== null || question.correctAnswer !== null)
      ) {
        throw new LearningAiOutputError(
          'Generated free-text question has unexpected answer options',
        );
      }
      return {
        ...question,
        sourceChunkIds: keepKnownChunkIds(question.sourceChunkIds, chunks),
      };
    });
    if (questions.some((question) => question.sourceChunkIds.length === 0)) {
      throw new LearningAiOutputError('Generated quiz contains an ungrounded question');
    }

    const quiz = await this.repository.saveQuiz({ program, questions });
    return {
      id: quiz.id,
      questions: quiz.questions.map(
        ({ correctAnswer: _correctAnswer, rubric: _rubric, ...safe }) => safe,
      ),
    };
  }

  async submitAnswer(input: {
    questionId: string;
    userId: string;
    answer: string;
    language: string;
  }) {
    const question = await this.repository.findOwnedQuestion(input.questionId, input.userId);
    if (!question) throw new LearningNotFoundError('Question not found');

    let evaluation;
    if (question.type === 'single_choice') {
      const isCorrect = question.correctAnswer?.trim() === input.answer.trim();
      evaluation = {
        score: isCorrect ? 1 : 0,
        feedback: isCorrect
          ? 'Ответ верный.'
          : `Ответ неверный. Правильный вариант: ${question.correctAnswer ?? 'не задан'}.`,
        missingPoints: isCorrect ? [] : question.rubric,
      };
    } else {
      const chunks = await this.knowledge.retrieve(question.sourceId, question.prompt, 8);
      evaluation = await this.ai.evaluateFreeAnswer({
        question,
        answer: input.answer,
        language: input.language,
        chunks,
      });
    }

    const stored = await this.repository.saveAttempt({
      question,
      userId: input.userId,
      answer: input.answer,
      evaluation,
    });
    return { ...evaluation, ...stored };
  }

  private async requireReadyOrPendingProgram(
    programId: string,
    userId: string,
    requireReady: boolean,
  ) {
    const program = await this.repository.findOwnedProgram(programId, userId);
    if (!program) throw new LearningNotFoundError('Learning program not found');
    if (requireReady && program.status !== 'ready') {
      throw new LearningStateError(`Program is ${program.status}`);
    }
    return program;
  }
}
