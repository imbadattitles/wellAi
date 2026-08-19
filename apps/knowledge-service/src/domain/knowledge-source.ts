export const sourceKinds = ['document', 'generated_topic'] as const;
export type SourceKind = (typeof sourceKinds)[number];

export const sourceStatuses = ['pending', 'processing', 'ready', 'failed'] as const;
export type SourceStatus = (typeof sourceStatuses)[number];

export interface KnowledgeSourceSnapshot {
  id: string;
  programId: string;
  userId: string;
  kind: SourceKind;
  status: SourceStatus;
  title: string;
  language: string;
  currentVersionId: string | null;
}

export interface KnowledgeChunkDraft {
  id: string;
  ordinal: number;
  text: string;
  page: number | null;
  heading: string | null;
  tokenCount: number;
  embedding: number[];
  topicId: string | null;
}

export interface KnowledgeTopicDraft {
  id: string;
  title: string;
  summary: string;
  position: number;
}

export interface RetrievedKnowledgeChunk {
  chunkId: string;
  sourceId: string;
  text: string;
  page: number | null;
  heading: string | null;
  similarity: number;
}
