import { randomUUID } from 'node:crypto';
import {
  createEnvelope,
  DocumentIngestionRequested,
  KnowledgeSourceReady,
  MessageEnvelope,
  MessageTypes,
} from '@wellllai/contracts';
import { InvalidDocumentError, SourceNotFoundError } from '../domain/errors';
import { KnowledgeChunkDraft } from '../domain/knowledge-source';
import { TextChunker } from '../domain/text-chunker';
import { BlobStoragePort } from '../ports/blob-storage.port';
import { EmbeddingPort } from '../ports/embedding.port';
import { KnowledgeRepositoryPort } from '../ports/knowledge-repository.port';
import { TextExtractionPort } from '../ports/text-extraction.port';

export class IngestDocumentUseCase {
  constructor(
    private readonly repository: KnowledgeRepositoryPort,
    private readonly blobStorage: BlobStoragePort,
    private readonly extractor: TextExtractionPort,
    private readonly embeddings: EmbeddingPort,
    private readonly chunker: TextChunker,
  ) {}

  async execute(
    payload: DocumentIngestionRequested,
    command: MessageEnvelope<DocumentIngestionRequested>,
  ): Promise<void> {
    const source = await this.repository.findSource(payload.sourceId);
    if (!source) throw new SourceNotFoundError(payload.sourceId);
    if (
      source.kind !== 'document' ||
      source.programId !== payload.programId ||
      source.userId !== payload.userId
    ) {
      throw new InvalidDocumentError('The ingestion command does not match its source');
    }

    const claimed = await this.repository.claimForProcessing(payload.sourceId);
    if (!claimed) return;

    const blob = await this.blobStorage.get(payload.sourceId);
    if (!blob) {
      throw new InvalidDocumentError('The PDF blob is missing');
    }

    const extracted = await this.extractor.extractPdf(blob.data);
    const chunkContents = this.chunker.chunk(
      extracted.pages.map((page) => ({
        text: page.text,
        page: page.page,
        heading: null,
      })),
    );

    if (chunkContents.length === 0) {
      throw new InvalidDocumentError(
        'No text could be extracted. Scanned PDFs require OCR, which is outside the MVP.',
      );
    }

    const vectors = await this.embeddings.embed(chunkContents.map((chunk) => chunk.text));
    if (vectors.length !== chunkContents.length) {
      throw new Error('The embedding provider returned an unexpected number of vectors');
    }

    const chunks: KnowledgeChunkDraft[] = chunkContents.map((chunk, index) => ({
      id: randomUUID(),
      ordinal: index,
      text: chunk.text,
      page: chunk.page,
      heading: chunk.heading,
      tokenCount: chunk.tokenCount,
      embedding: vectors[index] ?? [],
      topicId: null,
    }));
    const versionId = randomUUID();
    const readyPayload: KnowledgeSourceReady = {
      sourceId: source.id,
      programId: source.programId,
      knowledgeVersionId: versionId,
      title: source.title,
      topicIds: [],
    };
    const readyEvent = createEnvelope({
      messageType: MessageTypes.knowledgeSourceReady,
      producer: 'knowledge-service',
      aggregateId: source.id,
      correlationId: command.correlationId,
      causationId: command.messageId,
      traceparent: command.traceparent,
      payload: readyPayload,
    });

    await this.repository.publishVersion({
      sourceId: source.id,
      versionId,
      title: source.title,
      embeddingModel: this.embeddings.model,
      embeddingDimensions: this.embeddings.dimensions,
      generationModel: null,
      chunks,
      topics: [],
      readyEvent: { ...readyEvent, payload: readyPayload },
    });
  }
}
