export class LearningError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = 'LearningError';
  }
}

export class LearningNotFoundError extends LearningError {
  constructor(message: string) {
    super('LEARNING_RESOURCE_NOT_FOUND', message, 404);
  }
}

export class LearningStateError extends LearningError {
  constructor(message: string) {
    super('LEARNING_PROGRAM_NOT_READY', message, 409);
  }
}

export class LearningMaterialError extends LearningError {
  constructor(message: string) {
    super('LEARNING_MATERIAL_INSUFFICIENT', message, 422);
  }
}

export class LearningAiOutputError extends LearningError {
  constructor(message: string) {
    super('LEARNING_AI_OUTPUT_INVALID', message, 502);
  }
}
