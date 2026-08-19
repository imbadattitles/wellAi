import { Pool, PoolClient, PoolConfig } from 'pg';

export interface Transaction {
  query: PoolClient['query'];
}

export function createPostgresPool(connectionString: string, applicationName: string): Pool {
  const config: PoolConfig = {
    connectionString,
    application_name: applicationName,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  };
  return new Pool(config);
}

export async function inTransaction<T>(
  pool: Pool,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function assertSqlIdentifier(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }
  return value;
}
