CREATE TABLE IF NOT EXISTS persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  normalized_name TEXT NOT NULL,
  encounter_count INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, normalized_name)
);

CREATE INDEX IF NOT EXISTS persons_user_id_idx ON persons(user_id);
