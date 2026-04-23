-- Migration: per-group review status for failed copilot questions.
-- Allows admins to mark a normalized question group as 'resolved' or 'ignored'
-- so it stops polluting the "Aprendizado do Copiloto" panel.

CREATE TABLE IF NOT EXISTS ai_query_log_reviews (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  normalized TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_query_log_reviews_profile_normalized_idx
  ON ai_query_log_reviews(profile_id, normalized);
