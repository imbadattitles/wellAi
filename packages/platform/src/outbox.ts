import { MessageEnvelope } from '@wellllai/contracts';
import { Pool, PoolClient } from 'pg';
import { EventPublisher } from './kafka';
import { assertSqlIdentifier, inTransaction } from './postgres';

export interface OutboxMessage {
  id: string;
  topic: string;
  partitionKey: string;
  envelope: MessageEnvelope;
}

export async function addToOutbox(
  client: PoolClient,
  schemaName: string,
  topic: string,
  partitionKey: string,
  envelope: MessageEnvelope,
): Promise<void> {
  const schema = assertSqlIdentifier(schemaName);
  await client.query(
    `INSERT INTO ${schema}.outbox_messages
      (id, topic, partition_key, envelope, created_at)
     VALUES ($1, $2, $3, $4::jsonb, NOW())`,
    [envelope.messageId, topic, partitionKey, JSON.stringify(envelope)],
  );
}

export class PgOutboxRelay {
  constructor(
    private readonly pool: Pool,
    private readonly schemaName: string,
    private readonly publisher: EventPublisher,
  ) {}

  async publishBatch(limit = 50): Promise<number> {
    const schema = assertSqlIdentifier(this.schemaName);
    return inTransaction(this.pool, async (client) => {
      const result = await client.query<{
        id: string;
        topic: string;
        partition_key: string;
        envelope: MessageEnvelope;
      }>(
        `SELECT id, topic, partition_key, envelope
           FROM ${schema}.outbox_messages
          WHERE published_at IS NULL
          ORDER BY created_at
          LIMIT $1
          FOR UPDATE SKIP LOCKED`,
        [limit],
      );

      for (const row of result.rows) {
        await this.publisher.publish(row.topic, row.partition_key, row.envelope);
        await client.query(
          `UPDATE ${schema}.outbox_messages SET published_at = NOW() WHERE id = $1`,
          [row.id],
        );
      }

      return result.rowCount ?? 0;
    });
  }
}
