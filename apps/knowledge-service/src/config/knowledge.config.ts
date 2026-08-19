import { z } from 'zod';

const environmentSchema = z.object({
  DATABASE_URL: z.string().min(1),
  KAFKA_BROKERS: z.string().min(1),
  KNOWLEDGE_SERVICE_PORT: z.coerce.number().int().min(1).max(65_535).default(3011),
  KNOWLEDGE_GRPC_BIND_URL: z.string().min(3).default('0.0.0.0:4011'),
  KNOWLEDGE_KAFKA_CLIENT_ID: z.string().min(1).default('knowledge-service'),
  KNOWLEDGE_KAFKA_GROUP_ID: z.string().min(1).default('knowledge-service-v1'),
  KNOWLEDGE_OUTBOX_POLL_MS: z.coerce.number().int().min(100).default(500),
  KNOWLEDGE_MAX_DOCUMENT_BYTES: z.coerce
    .number()
    .int()
    .min(1_024)
    .max(25 * 1_024 * 1_024)
    .default(15 * 1_024 * 1_024),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  OPENAI_TEXT_MODEL: z.string().min(1).default('gpt-5.6-terra'),
  OPENAI_EMBEDDING_MODEL: z.string().min(1).default('text-embedding-3-small'),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().min(1_000).default(60_000),
});

export interface KnowledgeConfig {
  databaseUrl: string;
  kafkaBrokers: string[];
  port: number;
  grpcBindUrl: string;
  kafkaClientId: string;
  kafkaGroupId: string;
  outboxPollMs: number;
  maxDocumentBytes: number;
  openAi: {
    apiKey: string;
    baseUrl: string;
    textModel: string;
    embeddingModel: string;
    timeoutMs: number;
  };
}

export function readKnowledgeConfig(environment: NodeJS.ProcessEnv = process.env): KnowledgeConfig {
  const parsed = environmentSchema.parse(environment);
  const kafkaBrokers = parsed.KAFKA_BROKERS.split(',')
    .map((broker) => broker.trim())
    .filter(Boolean);

  if (kafkaBrokers.length === 0) {
    throw new Error('KAFKA_BROKERS must contain at least one broker');
  }

  return {
    databaseUrl: parsed.DATABASE_URL,
    kafkaBrokers,
    port: parsed.KNOWLEDGE_SERVICE_PORT,
    grpcBindUrl: parsed.KNOWLEDGE_GRPC_BIND_URL,
    kafkaClientId: parsed.KNOWLEDGE_KAFKA_CLIENT_ID,
    kafkaGroupId: parsed.KNOWLEDGE_KAFKA_GROUP_ID,
    outboxPollMs: parsed.KNOWLEDGE_OUTBOX_POLL_MS,
    maxDocumentBytes: parsed.KNOWLEDGE_MAX_DOCUMENT_BYTES,
    openAi: {
      apiKey: parsed.OPENAI_API_KEY,
      baseUrl: parsed.OPENAI_BASE_URL.replace(/\/$/, ''),
      textModel: parsed.OPENAI_TEXT_MODEL,
      embeddingModel: parsed.OPENAI_EMBEDDING_MODEL,
      timeoutMs: parsed.OPENAI_TIMEOUT_MS,
    },
  };
}
