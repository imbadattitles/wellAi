import { Pool } from 'pg';
import { CommandInboxPort, InboxClaim } from '../../ports/command-inbox.port';

interface InboxRow {
  status: 'processing' | 'completed' | 'failed';
  locked: boolean;
}

export class PostgresCommandInboxAdapter implements CommandInboxPort {
  constructor(private readonly pool: Pool) {}

  async claim(messageId: string, messageType: string): Promise<InboxClaim> {
    const inserted = await this.pool.query(
      `INSERT INTO knowledge.inbox_messages
        (message_id, message_type, status, attempts, locked_until)
       VALUES ($1, $2, 'processing', 1, NOW() + INTERVAL '10 minutes')
       ON CONFLICT (message_id) DO NOTHING
       RETURNING message_id`,
      [messageId, messageType],
    );
    if (inserted.rowCount === 1) return 'acquired';

    const current = await this.pool.query<InboxRow>(
      `SELECT status, locked_until > NOW() AS locked
         FROM knowledge.inbox_messages
        WHERE message_id = $1`,
      [messageId],
    );
    const row = current.rows[0];
    if (row?.status === 'completed') return 'completed';
    if (row?.status === 'processing' && row.locked) return 'busy';

    const reacquired = await this.pool.query(
      `UPDATE knowledge.inbox_messages
          SET status = 'processing',
              attempts = attempts + 1,
              locked_until = NOW() + INTERVAL '10 minutes',
              error_code = NULL
        WHERE message_id = $1
          AND (status = 'failed' OR locked_until IS NULL OR locked_until <= NOW())
      RETURNING message_id`,
      [messageId],
    );
    return reacquired.rowCount === 1 ? 'acquired' : 'busy';
  }

  async complete(messageId: string): Promise<void> {
    await this.pool.query(
      `UPDATE knowledge.inbox_messages
          SET status = 'completed', processed_at = NOW(), locked_until = NULL
        WHERE message_id = $1`,
      [messageId],
    );
  }

  async fail(messageId: string, errorCode: string): Promise<void> {
    await this.pool.query(
      `UPDATE knowledge.inbox_messages
          SET status = 'failed', error_code = $2, locked_until = NULL
        WHERE message_id = $1`,
      [messageId, errorCode.slice(0, 100)],
    );
  }
}
