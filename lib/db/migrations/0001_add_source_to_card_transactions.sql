-- Migration: Add source field to card_transactions
-- Applied via drizzle-kit push. This file documents the change.
-- Run manually if needed: psql $DATABASE_URL -f this_file.sql

ALTER TABLE card_transactions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

-- Backfill: any existing rows without a source get 'manual' (already handled by DEFAULT above)
-- This UPDATE is a no-op after the column is added with DEFAULT, kept for clarity:
UPDATE card_transactions SET source = 'manual' WHERE source IS NULL;
