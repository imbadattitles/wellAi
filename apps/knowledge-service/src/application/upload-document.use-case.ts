import { createHash } from 'node:crypto';
import { createEnvelope, DocumentIngestionRequested, MessageTypes } from '@wellllai/contracts';
import { InvalidDocumentError } from '../domain/errors';
import { KnowledgeSourceSnapshot } from '../domain/knowledge-source';
import { BlobStoragePort } from '../ports/blob-storage.port';
import { KnowledgeRepositoryPort } from '../ports/knowledge-repository.port';

export interface UploadDocumentInput {
  sourceId: string;
  programId: string;
  userId: string;
  language: string;
  fileName: string;
  mimeType: string;
  data: Buffer;
  idempotencyKey?: string;
  correlationId?: string;
  traceparent?: string | null;
}

export class UploadDocumentUseCase {
  constructor(
    private readonly repository: KnowledgeRepositoryPort,
    private readonly blobStorage: BlobStoragePort,
    private readonly maxDocumentBytes: number,
  ) {}

  async execute(input: UploadDocumentInput): Promise<KnowledgeSourceSnapshot> {
    this.validateDocument(input);

    const fileName = input.fileName.replace(/^.*[\\/]/, '').slice(0, 255);
    const sha256 = createHash('sha256').update(input.data).digest('hex');
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          sourceId: input.sourceId,
          programId: input.programId,
          userId: input.userId,
          language: input.language,
          fileName,
          sha256,
        }),
      )
      .digest('hex');

    await this.blobStorage.put({
      sourceId: input.sourceId,
      data: input.data,
      fileName,
      mimeType: 'application/pdf',
      sha256,
    });

    const payload: DocumentIngestionRequested = {
      sourceId: input.sourceId,
      programId: input.programId,
      userId: input.userId,
      fileName,
      mimeType: 'application/pdf',
      language: input.language,
    };
    const command = createEnvelope({
      messageType: MessageTypes.knowledgeDocumentIngestionRequested,
      producer: 'knowledge-service',
      aggregateId: input.sourceId,
      correlationId: input.correlationId ?? input.sourceId,
      traceparent: input.traceparent ?? null,
      payload,
    });

    return this.repository.registerDocumentSource({
      sourceId: input.sourceId,
      programId: input.programId,
      userId: input.userId,
      title: fileName.replace(/\.pdf$/i, '') || fileName,
      language: input.language,
      idempotencyKey: (input.idempotencyKey?.trim() || input.sourceId).slice(0, 200),
      requestHash,
      command: { ...command, payload },
    });
  }

  private validateDocument(input: UploadDocumentInput): void {
    if (input.mimeType !== 'application/pdf') {
      throw new InvalidDocumentError('Only application/pdf uploads are accepted');
    }
    if (input.data.length === 0) {
      throw new InvalidDocumentError('The uploaded PDF is empty');
    }
    if (input.data.length > this.maxDocumentBytes) {
      throw new InvalidDocumentError(
        `The uploaded PDF exceeds the ${this.maxDocumentBytes} byte limit`,
      );
    }
    if (input.data.subarray(0, 1_024).indexOf(Buffer.from('%PDF-')) < 0) {
      throw new InvalidDocumentError('The uploaded file does not contain a PDF header');
    }
  }
}
