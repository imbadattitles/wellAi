import {
  DocumentIngestionRequested,
  KnowledgeSourceFailed,
  KnowledgeSourceReady,
  MessageEnvelope,
  TopicMaterializationRequested,
} from '@wellllai/contracts';
import {
  KnowledgeChunkDraft,
  KnowledgeSourceSnapshot,
  KnowledgeTopicDraft,
  RetrievedKnowledgeChunk,
} from '../domain/knowledge-source';

export interface RegisterDocumentSourceInput {
  sourceId: string;
  programId: string;
  userId: string;
  title: string;
  language: string;
  idempotencyKey: string;
  requestHash: string;
  command: MessageEnvelope<DocumentIngestionRequested>;
}

export interface PublishKnowledgeVersionInput {
  sourceId: string;
  versionId: string;
  title: string;
  embeddingModel: string;
  embeddingDimensions: number;
  generationModel: string | null;
  chunks: KnowledgeChunkDraft[];
  topics: KnowledgeTopicDraft[];
  readyEvent: MessageEnvelope<KnowledgeSourceReady>;
}

export interface FailKnowledgeSourceInput {
  sourceId: string;
  failedEvent: MessageEnvelope<KnowledgeSourceFailed>;
}

export interface KnowledgeRepositoryPort {
  registerDocumentSource(input: RegisterDocumentSourceInput): Promise<KnowledgeSourceSnapshot>;
  ensureTopicSource(input: TopicMaterializationRequested): Promise<KnowledgeSourceSnapshot>;
  findSource(sourceId: string): Promise<KnowledgeSourceSnapshot | null>;
  claimForProcessing(sourceId: string): Promise<boolean>;
  publishVersion(input: PublishKnowledgeVersionInput): Promise<void>;
  failSource(input: FailKnowledgeSourceInput): Promise<void>;
  retrieve(
    sourceId: string,
    queryEmbedding: number[],
    limit: number,
  ): Promise<RetrievedKnowledgeChunk[]>;
}

export const KNOWLEDGE_REPOSITORY = Symbol('KNOWLEDGE_REPOSITORY');
