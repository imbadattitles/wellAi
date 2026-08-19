export class KnowledgeError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 422,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'KnowledgeError';
  }
}

export class SourceNotFoundError extends KnowledgeError {
  constructor(sourceId: string) {
    super('KNOWLEDGE_SOURCE_NOT_FOUND', `Knowledge source ${sourceId} was not found`, 404);
  }
}

export class SourceNotReadyError extends KnowledgeError {
  constructor(sourceId: string) {
    super('KNOWLEDGE_SOURCE_NOT_READY', `Knowledge source ${sourceId} is not ready`, 409);
  }
}

export class IdempotencyConflictError extends KnowledgeError {
  constructor() {
    super(
      'IDEMPOTENCY_KEY_REUSED',
      'The idempotency key was already used for a different request',
      409,
    );
  }
}

export class InvalidDocumentError extends KnowledgeError {
  constructor(message: string) {
    super('INVALID_PDF_DOCUMENT', message, 422);
  }
}

export class OpenAiRequestError extends KnowledgeError {
  constructor(message: string, retryable: boolean) {
    super('OPENAI_REQUEST_FAILED', message, 502, retryable);
  }
}
