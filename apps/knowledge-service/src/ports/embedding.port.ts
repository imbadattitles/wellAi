export interface EmbeddingPort {
  readonly model: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

export const EMBEDDING_PORT = Symbol('EMBEDDING_PORT');
