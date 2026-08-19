import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createPostgresPool, inTransaction } from '@wellllai/platform';
import { z } from 'zod';

async function migrate(): Promise<void> {
  const { DATABASE_URL } = z.object({ DATABASE_URL: z.string().min(1) }).parse(process.env);
  const pool = createPostgresPool(DATABASE_URL, 'knowledge-migrations');
  const migrationsDirectory = resolve(__dirname, '../../../migrations');

  try {
    await pool.query('CREATE SCHEMA IF NOT EXISTS knowledge');
    await pool.query(
      `CREATE TABLE IF NOT EXISTS knowledge.schema_migrations (
         name text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT NOW()
       )`,
    );

    const files = (await readdir(migrationsDirectory))
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const applied = await pool.query(
        'SELECT 1 FROM knowledge.schema_migrations WHERE name = $1',
        [file],
      );
      if (applied.rowCount) continue;

      const sql = await readFile(resolve(migrationsDirectory, file), 'utf8');
      await inTransaction(pool, async (client) => {
        await client.query(sql);
        await client.query('INSERT INTO knowledge.schema_migrations (name) VALUES ($1)', [file]);
      });
      process.stdout.write(`Applied ${file}\n`);
    }
  } finally {
    await pool.end();
  }
}

void migrate().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Migration failed'}\n`);
  process.exitCode = 1;
});
