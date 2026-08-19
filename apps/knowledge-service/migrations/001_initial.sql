CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS knowledge;

CREATE TABLE IF NOT EXISTS knowledge.knowledge_sources (
  id uuid PRIMARY KEY,
  program_id uuid NOT NULL,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('document', 'generated_topic')),
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  title varchar(255) NOT NULL,
  language varchar(16) NOT NULL,
  source_spec jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_version_id uuid NULL,
  processing_started_at timestamptz NULL,
  failure_code varchar(100) NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS knowledge_sources_program_idx
  ON knowledge.knowledge_sources (program_id);
CREATE INDEX IF NOT EXISTS knowledge_sources_user_idx
  ON knowledge.knowledge_sources (user_id);

-- Deliberately independent from knowledge_sources: storing the blob first makes an
-- upload retry safe. A failed registration can leave only a recoverable orphan blob.
CREATE TABLE IF NOT EXISTS knowledge.document_blobs (
  source_id uuid PRIMARY KEY,
  file_name varchar(255) NOT NULL,
  mime_type varchar(100) NOT NULL CHECK (mime_type = 'application/pdf'),
  sha256 char(64) NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0),
  content bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge.knowledge_versions (
  id uuid PRIMARY KEY,
  source_id uuid NOT NULL REFERENCES knowledge.knowledge_sources(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  title varchar(255) NOT NULL,
  embedding_model varchar(100) NOT NULL,
  embedding_dimensions integer NOT NULL CHECK (embedding_dimensions = 1536),
  generation_model varchar(100) NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, version)
);

CREATE TABLE IF NOT EXISTS knowledge.topics (
  id uuid PRIMARY KEY,
  knowledge_version_id uuid NOT NULL
    REFERENCES knowledge.knowledge_versions(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL,
  summary text NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  UNIQUE (knowledge_version_id, position)
);

CREATE TABLE IF NOT EXISTS knowledge.chunks (
  id uuid PRIMARY KEY,
  knowledge_version_id uuid NOT NULL
    REFERENCES knowledge.knowledge_versions(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES knowledge.knowledge_sources(id) ON DELETE CASCADE,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  text text NOT NULL,
  page integer NULL CHECK (page IS NULL OR page > 0),
  heading varchar(500) NULL,
  token_count integer NOT NULL CHECK (token_count > 0),
  embedding vector(1536) NOT NULL,
  UNIQUE (knowledge_version_id, ordinal)
);

CREATE TABLE IF NOT EXISTS knowledge.topic_chunks (
  topic_id uuid NOT NULL REFERENCES knowledge.topics(id) ON DELETE CASCADE,
  chunk_id uuid NOT NULL REFERENCES knowledge.chunks(id) ON DELETE CASCADE,
  PRIMARY KEY (topic_id, chunk_id)
);

CREATE INDEX IF NOT EXISTS chunks_source_version_idx
  ON knowledge.chunks (source_id, knowledge_version_id);
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx
  ON knowledge.chunks USING hnsw (embedding vector_cosine_ops);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
     WHERE c.conname = 'knowledge_sources_current_version_fk'
       AND n.nspname = 'knowledge'
  ) THEN
    ALTER TABLE knowledge.knowledge_sources
      ADD CONSTRAINT knowledge_sources_current_version_fk
      FOREIGN KEY (current_version_id)
      REFERENCES knowledge.knowledge_versions(id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS knowledge.outbox_messages (
  id uuid PRIMARY KEY,
  topic varchar(200) NOT NULL,
  partition_key varchar(200) NOT NULL,
  envelope jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  published_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS outbox_unpublished_idx
  ON knowledge.outbox_messages (created_at)
  WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS knowledge.inbox_messages (
  message_id uuid PRIMARY KEY,
  message_type varchar(200) NOT NULL DEFAULT 'unknown',
  status varchar(20) NOT NULL DEFAULT 'completed'
    CHECK (status IN ('processing', 'completed', 'failed')),
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts > 0),
  locked_until timestamptz NULL,
  error_code varchar(100) NULL,
  received_at timestamptz NOT NULL DEFAULT NOW(),
  processed_at timestamptz NULL
);

CREATE TABLE IF NOT EXISTS knowledge.idempotency_keys (
  scope varchar(100) NOT NULL,
  key varchar(200) NOT NULL,
  request_hash char(64) NOT NULL,
  source_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  expires_at timestamptz NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  PRIMARY KEY (scope, key)
);
