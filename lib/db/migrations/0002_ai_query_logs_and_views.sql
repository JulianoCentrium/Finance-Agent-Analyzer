-- Migration: AI query logs + financial summary views
-- Applied via drizzle-kit push for the table; views are created via CREATE OR REPLACE below.

CREATE TABLE IF NOT EXISTS ai_query_logs (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  sql_generated TEXT,
  intent TEXT,
  success TEXT NOT NULL DEFAULT 'true',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_query_logs_profile_id_idx ON ai_query_logs(profile_id);
CREATE INDEX IF NOT EXISTS ai_query_logs_created_at_idx ON ai_query_logs(created_at DESC);

-- Aggregated monthly spending per category (expenses only).
CREATE OR REPLACE VIEW monthly_category_summary AS
SELECT
  ct.profile_id,
  EXTRACT(YEAR FROM ct.date)::int AS year,
  EXTRACT(MONTH FROM ct.date)::int AS month,
  ct.category_id,
  COALESCE(c.name, 'Não classificado') AS category_name,
  SUM(ABS(ct.amount))::numeric(15,2) AS total_expense
FROM card_transactions ct
LEFT JOIN categories c ON c.id = ct.category_id
WHERE ct.amount < 0
  AND ct.status = 'active'
GROUP BY ct.profile_id, year, month, ct.category_id, c.name;

-- Per-card summary: current invoice total + remaining installments.
CREATE OR REPLACE VIEW credit_card_summary AS
SELECT
  cc.profile_id,
  cc.id AS card_id,
  cc.name AS card_name,
  cc.brand,
  cc.credit_limit,
  COALESCE((
    SELECT SUM(ABS(ct.amount))
    FROM card_transactions ct
    WHERE ct.card_id = cc.id
      AND ct.amount < 0
      AND ct.status = 'active'
      AND EXTRACT(YEAR FROM ct.date) = EXTRACT(YEAR FROM CURRENT_DATE)
      AND EXTRACT(MONTH FROM ct.date) = EXTRACT(MONTH FROM CURRENT_DATE)
  ), 0)::numeric(15,2) AS current_invoice_total,
  COALESCE((
    SELECT SUM((ci.total_amount / ci.total_installments) * (ci.total_installments - ci.current_installment + 1))
    FROM card_installments ci
    WHERE ci.card_id = cc.id
      AND ci.current_installment <= ci.total_installments
  ), 0)::numeric(15,2) AS open_installments_remaining
FROM credit_cards cc
WHERE cc.is_active = true;
