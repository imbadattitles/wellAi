import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://wellllai:wellllai@postgres:5432/wellllai';

const targets = [
  { schema: 'knowledge', directory: 'apps/knowledge-service/migrations' },
  { schema: 'learning', directory: 'apps/learning-service/migrations' },
  { schema: 'interview', directory: 'apps/interview-service/migrations' },
];

function quoteIdentifier(identifier) {
  if (!/^[a-z_][a-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

async function applyTarget(pool, target) {
  const schema = quoteIdentifier(target.schema);
  const migrationsDirectory = resolve(repositoryRoot, target.directory);

  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${schema}.schema_migrations (
       name text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT NOW()
     )`,
  );

  const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `wellllai:${target.schema}:migrations`,
      ]);

      const applied = await client.query(
        `SELECT 1 FROM ${schema}.schema_migrations WHERE name = $1`,
        [file],
      );
      if (applied.rowCount) {
        await client.query('COMMIT');
        process.stdout.write(`Already applied ${target.schema}/${file}\n`);
        continue;
      }

      const sql = await readFile(resolve(migrationsDirectory, file), 'utf8');
      await client.query(sql);
      await client.query(`INSERT INTO ${schema}.schema_migrations (name) VALUES ($1)`, [file]);
      await client.query('COMMIT');
      process.stdout.write(`Applied ${target.schema}/${file}\n`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

const pool = new Pool({
  connectionString,
  application_name: 'wellllai-dev-migrations',
  max: 1,
  connectionTimeoutMillis: 5_000,
});

try {
  for (const target of targets) {
    await applyTarget(pool, target);
  }
} finally {
  await pool.end();
}
