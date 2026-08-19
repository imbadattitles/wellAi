import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export const messageEnvelopeSchema = z.object({
  messageId: z.string().uuid(),
  messageType: z.string().min(1),
  schemaVersion: z.literal(1),
  occurredAt: z.string().datetime(),
  producer: z.string().min(1),
  aggregateId: z.string().uuid(),
  correlationId: z.string().uuid(),
  causationId: z.string().uuid().nullable(),
  traceparent: z.string().nullable(),
  payload: z.unknown(),
});

export type MessageEnvelope<T = unknown> = Omit<
  z.infer<typeof messageEnvelopeSchema>,
  'payload'
> & {
  payload: T;
};

export interface CreateEnvelopeInput<T> {
  messageType: string;
  producer: string;
  aggregateId: string;
  correlationId?: string;
  causationId?: string | null;
  traceparent?: string | null;
  payload: T;
}

export function createEnvelope<T>(input: CreateEnvelopeInput<T>): MessageEnvelope<T> {
  return {
    messageId: randomUUID(),
    messageType: input.messageType,
    schemaVersion: 1,
    occurredAt: new Date().toISOString(),
    producer: input.producer,
    aggregateId: input.aggregateId,
    correlationId: input.correlationId ?? randomUUID(),
    causationId: input.causationId ?? null,
    traceparent: input.traceparent ?? null,
    payload: input.payload,
  };
}

export function parseEnvelope<T>(value: unknown, payloadSchema: z.ZodType<T>): MessageEnvelope<T> {
  const envelope = messageEnvelopeSchema.parse(value);
  return {
    ...envelope,
    payload: payloadSchema.parse(envelope.payload),
  };
}
