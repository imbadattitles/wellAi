import { Pool, PoolClient } from 'pg';
import { assertSqlIdentifier, inTransaction } from './postgres';

export async function consumeOnce<T>(
  pool: Pool,
  schemaName: string,
  messageId: string,
  handler: (client: PoolClient) => Promise<T>,
): Promise<{ processed: boolean; result: T | null }> {
  const schema = assertSqlIdentifier(schemaName);
  return inTransaction(pool, async (client) => {
    const insertion = await client.query(
      `INSERT INTO ${schema}.inbox_messages (message_id, processed_at)
       VALUES ($1, NOW())
       ON CONFLICT (message_id) DO NOTHING
       RETURNING message_id`,
      [messageId],
    );

    if (insertion.rowCount === 0) {
      return { processed: false, result: null };
    }

    return { processed: true, result: await handler(client) };
  });
}
