CREATE SCHEMA IF NOT EXISTS learning;

CREATE TABLE IF NOT EXISTS learning.programs (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  source_id uuid NOT NULL UNIQUE,
  source_type text NOT NULL CHECK (source_type IN ('document', 'generated_topic')),
  title text NOT NULL,
  goal text NOT NULL DEFAULT '',
  level text NOT NULL,
  language varchar(16) NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  failure_code text,
  knowledge_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS learning_programs_user_created_idx
  ON learning.programs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS learning.question_answers (
  id uuid PRIMARY KEY,
  program_id uuid NOT NULL REFERENCES learning.programs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  citations jsonb NOT NULL,
  insufficient_context boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learning.quizzes (
  id uuid PRIMARY KEY,
  program_id uuid NOT NULL REFERENCES learning.programs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('processing', 'ready', 'failed')),
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learning.questions (
  id uuid PRIMARY KEY,
  quiz_id uuid NOT NULL REFERENCES learning.quizzes(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES learning.programs(id) ON DELETE CASCADE,
  source_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('single_choice', 'free_text')),
  topic text NOT NULL,
  prompt text NOT NULL,
  options jsonb,
  correct_answer text,
  rubric jsonb NOT NULL,
  source_chunk_ids uuid[] NOT NULL
);

CREATE TABLE IF NOT EXISTS learning.attempts (
  id uuid PRIMARY KEY,
  question_id uuid NOT NULL REFERENCES learning.questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  answer text NOT NULL,
  score double precision NOT NULL CHECK (score >= 0 AND score <= 1),
  feedback text NOT NULL,
  missing_points jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learning.mastery (
  user_id uuid NOT NULL,
  program_id uuid NOT NULL REFERENCES learning.programs(id) ON DELETE CASCADE,
  topic text NOT NULL,
  score double precision NOT NULL CHECK (score >= 0 AND score <= 1),
  attempt_count integer NOT NULL CHECK (attempt_count > 0),
  last_reviewed_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, program_id, topic)
);

CREATE TABLE IF NOT EXISTS learning.outbox_messages (
  id uuid PRIMARY KEY,
  topic text NOT NULL,
  partition_key text NOT NULL,
  envelope jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS learning_outbox_unpublished_idx
  ON learning.outbox_messages (created_at)
  WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS learning.inbox_messages (
  message_id uuid PRIMARY KEY,
  processed_at timestamptz NOT NULL
);
