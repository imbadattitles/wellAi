CREATE SCHEMA IF NOT EXISTS interview;

CREATE TABLE IF NOT EXISTS interview.sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  profession varchar(120) NOT NULL,
  level text NOT NULL CHECK (level IN ('junior', 'middle', 'senior', 'lead')),
  format text NOT NULL CHECK (format IN ('technical', 'behavioral', 'mixed')),
  technologies jsonb NOT NULL CHECK (jsonb_typeof(technologies) = 'array'),
  vacancy_text text,
  language varchar(16) NOT NULL,
  status text NOT NULL
    CHECK (status IN ('scenario_pending', 'active', 'completed', 'failed')),
  report_status text NOT NULL
    CHECK (report_status IN ('not_requested', 'pending', 'ready', 'failed')),
  scenario jsonb,
  report jsonb,
  failure_code text,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS interview_sessions_user_created_idx
  ON interview.sessions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS interview.turns (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES interview.sessions(id) ON DELETE CASCADE,
  answer_id uuid NOT NULL,
  question_index integer NOT NULL CHECK (question_index >= 0),
  question text NOT NULL,
  answer text NOT NULL,
  feedback text NOT NULL,
  score double precision NOT NULL CHECK (score >= 0 AND score <= 1),
  strengths jsonb NOT NULL CHECK (jsonb_typeof(strengths) = 'array'),
  gaps jsonb NOT NULL CHECK (jsonb_typeof(gaps) = 'array'),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, answer_id),
  UNIQUE (session_id, question_index)
);

CREATE TABLE IF NOT EXISTS interview.outbox_messages (
  id uuid PRIMARY KEY,
  topic text NOT NULL,
  partition_key text NOT NULL,
  envelope jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS interview_outbox_unpublished_idx
  ON interview.outbox_messages (created_at)
  WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS interview.inbox_messages (
  message_id uuid PRIMARY KEY,
  processed_at timestamptz NOT NULL
);
