import { describe, expect, it, vi } from 'vitest';
import { LearningApplicationService } from './learning.service';
import { KnowledgeRetrievalPort, LearningAiPort, LearningRepository } from './ports';

describe('LearningApplicationService', () => {
  it('marks only the owned document program when its upload fails', async () => {
    const pendingProgram = {
      id: 'ea5655d4-248b-4f9d-a846-d6eab73f03ff',
      userId: '79da53cb-b115-444d-b9a1-fcad3e43bca5',
      sourceId: 'a65f7855-14b3-4ce4-bc86-5fe472527a4d',
      sourceType: 'document' as const,
      title: 'PostgreSQL',
      goal: '',
      level: 'unspecified',
      language: 'ru',
      status: 'pending' as const,
      failureCode: null,
      knowledgeVersionId: null,
      createdAt: new Date(),
    };
    const failedProgram = {
      ...pendingProgram,
      status: 'failed' as const,
      failureCode: 'INVALID_PDF_DOCUMENT',
    };
    const repository = {
      findOwnedProgram: vi.fn().mockResolvedValue(pendingProgram),
      markDocumentUploadFailed: vi.fn().mockResolvedValue(failedProgram),
    } as unknown as LearningRepository;
    const service = new LearningApplicationService(
      repository,
      {} as KnowledgeRetrievalPort,
      {} as LearningAiPort,
    );

    const result = await service.markDocumentUploadFailed({
      programId: pendingProgram.id,
      sourceId: pendingProgram.sourceId,
      userId: pendingProgram.userId,
      errorCode: 'INVALID_PDF_DOCUMENT',
    });

    expect(result.status).toBe('failed');
    expect(repository.markDocumentUploadFailed).toHaveBeenCalledOnce();
  });

  it('does not downgrade a document program that became ready', async () => {
    const readyProgram = {
      id: 'ea5655d4-248b-4f9d-a846-d6eab73f03ff',
      userId: '79da53cb-b115-444d-b9a1-fcad3e43bca5',
      sourceId: 'a65f7855-14b3-4ce4-bc86-5fe472527a4d',
      sourceType: 'document' as const,
      title: 'PostgreSQL',
      goal: '',
      level: 'unspecified',
      language: 'ru',
      status: 'ready' as const,
      failureCode: null,
      knowledgeVersionId: 'cfc71787-6627-4be0-8685-58f34b019ab3',
      createdAt: new Date(),
    };
    const repository = {
      findOwnedProgram: vi.fn().mockResolvedValue(readyProgram),
      markDocumentUploadFailed: vi.fn(),
    } as unknown as LearningRepository;
    const service = new LearningApplicationService(
      repository,
      {} as KnowledgeRetrievalPort,
      {} as LearningAiPort,
    );

    const result = await service.markDocumentUploadFailed({
      programId: readyProgram.id,
      sourceId: readyProgram.sourceId,
      userId: readyProgram.userId,
      errorCode: 'KNOWLEDGE_DOCUMENT_UPLOAD_FAILED',
    });

    expect(result.status).toBe('ready');
    expect(repository.markDocumentUploadFailed).not.toHaveBeenCalled();
  });

  it('answers from retrieved context and persists only a verified citation', async () => {
    const program = {
      id: 'ea5655d4-248b-4f9d-a846-d6eab73f03ff',
      userId: '79da53cb-b115-444d-b9a1-fcad3e43bca5',
      sourceId: 'a65f7855-14b3-4ce4-bc86-5fe472527a4d',
      sourceType: 'document' as const,
      title: 'PostgreSQL',
      goal: 'Learn transactions',
      level: 'beginner',
      language: 'ru',
      status: 'ready' as const,
      failureCode: null,
      knowledgeVersionId: 'cfc71787-6627-4be0-8685-58f34b019ab3',
      createdAt: new Date(),
    };
    const chunk = {
      chunkId: '8d75b521-f967-41d6-9b3a-5267b08d8512',
      sourceId: program.sourceId,
      text: 'MVCC keeps multiple row versions for concurrent transactions.',
      page: 4,
      heading: 'MVCC',
      similarity: 0.93,
    };
    const repository = {
      findOwnedProgram: vi.fn().mockResolvedValue(program),
      saveCitedAnswer: vi.fn().mockResolvedValue({ id: 'answer-id' }),
    } as unknown as LearningRepository;
    const knowledge = {
      retrieve: vi.fn().mockResolvedValue([chunk]),
    } as KnowledgeRetrievalPort;
    const ai = {
      answerQuestion: vi.fn().mockResolvedValue({
        answer: 'MVCC хранит несколько версий строк.',
        citations: [{ chunkId: chunk.chunkId, quote: 'multiple row versions' }],
        insufficientContext: false,
      }),
    } as unknown as LearningAiPort;
    const service = new LearningApplicationService(repository, knowledge, ai);

    const result = await service.answerQuestion({
      programId: program.id,
      userId: program.userId,
      question: 'Что делает MVCC?',
      language: 'ru',
    });

    expect(result.citations).toHaveLength(1);
    expect(repository.saveCitedAnswer).toHaveBeenCalledOnce();
  });
});
