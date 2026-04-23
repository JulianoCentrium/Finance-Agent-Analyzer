/**
 * Structured description of the financial database schema injected into AI prompts.
 * The AI uses this to generate accurate SELECT queries against PostgreSQL.
 *
 * IMPORTANT: every query must filter by `profile_id = :profileId` to ensure
 * tenant isolation. The executor enforces this as well.
 */
export const DB_SCHEMA_CONTEXT = `
Você tem acesso somente-leitura a um banco PostgreSQL com o seguinte esquema financeiro.
Todas as tabelas (exceto profiles) possuem a coluna profile_id (INTEGER) e DEVEM ser filtradas por profile_id = :profileId.
Valores monetários são NUMERIC(15,2) em BRL. Datas são DATE (formato YYYY-MM-DD).

TABELA profiles
  - id SERIAL, clerk_user_id TEXT, name TEXT, status TEXT

TABELA bank_accounts (contas bancárias do usuário)
  - id, profile_id, name TEXT, bank TEXT, account_number TEXT, agency TEXT
  - balance NUMERIC (saldo atual)
  - is_active BOOLEAN

TABELA credit_cards (cartões de crédito)
  - id, profile_id, name TEXT, brand TEXT (Visa, Mastercard, etc.), last_four TEXT
  - credit_limit NUMERIC, closing_day INT (1-31), due_day INT (1-31)
  - is_active BOOLEAN

TABELA invoices (faturas mensais de cartão)
  - id, profile_id, card_id (FK credit_cards), year INT, month INT
  - total_amount NUMERIC, status TEXT ('open' | 'closed' | 'paid'), due_date DATE, paid_at DATE

TABELA card_transactions (lançamentos no cartão de crédito)
  - id, profile_id, invoice_id, card_id, category_id, date DATE, description TEXT
  - amount NUMERIC (NEGATIVO = despesa, POSITIVO = estorno/crédito). Para despesas use ABS(amount).
  - is_installment BOOLEAN, installment_number INT, total_installments INT
  - source TEXT ('manual' | 'import'), status TEXT ('active' | 'deleted')

TABELA card_installments (parcelamentos consolidados no cartão)
  - id, profile_id, card_id, description TEXT, merchant TEXT
  - total_amount NUMERIC (valor total da compra parcelada)
  - total_installments INT, current_installment INT
  - first_installment_date DATE

TABELA categories (categorias de despesa/receita)
  - id, profile_id, name TEXT, color TEXT, icon TEXT
  - type category_type ('expense' | 'income' | 'both')
  - is_active BOOLEAN

TABELA accounts_payable (contas a pagar)
  - id, profile_id, description TEXT, amount NUMERIC, due_date DATE
  - status TEXT ('open' | 'paid' | 'overdue')
  - category_id, person_id, bank_account_id, invoice_id, paid_at DATE, paid_amount NUMERIC
  - recurrent BOOLEAN

TABELA accounts_receivable (contas a receber)
  - id, profile_id, description TEXT, amount NUMERIC, due_date DATE
  - status TEXT ('open' | 'received' | 'overdue')
  - category_id, person_id, bank_account_id, received_at DATE, received_amount NUMERIC

VIEWS DISPONÍVEIS (use quando possível para melhor performance):
  - monthly_category_summary(profile_id, year, month, category_id, category_name, total_expense)
  - credit_card_summary(profile_id, card_id, card_name, brand, credit_limit, current_invoice_total, open_installments_remaining)

REGRAS OBRIGATÓRIAS PARA SQL:
1. APENAS SELECT. Nada de INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/TRUNCATE.
2. Sempre incluir LIMIT 100 no final.
3. Sempre filtrar por profile_id = :profileId nas tabelas que possuem essa coluna.
4. Não usar ponto-e-vírgula múltiplos. Apenas UMA query.
5. Use JOINs quando precisar de nomes (ex: nome da categoria/cartão/conta).
6. Para "este mês"/"mês atual" use EXTRACT(YEAR/MONTH FROM CURRENT_DATE).
7. Para gastos no cartão use ABS(amount) WHERE amount < 0.
`.trim();
