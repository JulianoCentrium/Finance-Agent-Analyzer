/**
 * Pre-built parameterized SQL templates for the most common financial questions.
 * These bypass the LLM SQL generation step for speed and accuracy.
 *
 * IMPORTANT: every tenant-scoped table referenced (including via JOIN) MUST
 * include `profile_id = ${profileId}` so the executor's tenant-scope check
 * accepts it.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * HOW TO ADD A NEW INTENT
 * ──────────────────────────────────────────────────────────────────────────
 * 1. Open the "Aprendizado do Copiloto" card in Settings (/settings) to
 *    inspect the most frequent failed questions. Each row shows a normalized
 *    sample, the number of occurrences, and the last error returned.
 * 2. Pick a recurring failure and choose a stable `name` (snake_case, e.g.
 *    `card_spending_named_current_month`). The name is what gets stored in
 *    `ai_query_logs.intent` so it doubles as a metric.
 * 3. Add an entry to the `INTENTS` array below with:
 *      - `patterns`: one or more case-insensitive RegExp. Matching is run
 *        against both the normalized (accent-stripped, lowercased) text and
 *        the raw question, so accents in the regex are optional.
 *      - `build`: returns the parameterized SQL. Always inject `${profileId}`
 *        on every tenant-scoped table — including JOINs — or the safe SQL
 *        executor will reject the query.
 * 4. If your intent extracts free-text values (account name, category, etc.)
 *    remember to escape single quotes via `.replace(/'/g, "''")` exactly like
 *    the existing intents do.
 * 5. Add or extend a unit test under
 *    `artifacts/api-server/src/__tests__/known-intents.test.ts` covering the
 *    new pattern. Run `pnpm --filter @workspace/api-server test`.
 * 6. Re-deploy and watch the same Settings card — the question should stop
 *    showing up as a failure once the intent ships.
 *
 * Tip: if a question is too open-ended for a static template, leave it for
 * the LLM fallback (it requires the user's OpenRouter key) instead of
 * forcing a brittle regex.
 */

export interface KnownIntentMatch {
  sql: string;
  intent: string;
}

interface IntentDef {
  name: string;
  patterns: RegExp[];
  build: (profileId: number, match: RegExpMatchArray) => string;
}

const NORMALIZE = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const INTENTS: IntentDef[] = [
  {
    name: "account_balance_named",
    patterns: [/saldo (?:da conta|do banco|da|do)\s+([\w\s]+?)(?:\?|$)/i],
    build: (profileId, m) => {
      const name = (m[1] ?? "").trim().replace(/'/g, "''");
      return `
        SELECT name, bank, balance
        FROM bank_accounts
        WHERE profile_id = ${profileId}
          AND is_active = true
          AND (LOWER(name) LIKE LOWER('%${name}%') OR LOWER(bank) LIKE LOWER('%${name}%'))
        LIMIT 10
      `.trim();
    },
  },
  {
    name: "account_balance_all",
    patterns: [
      /\b(qual|meu|saldo)\b.*\b(saldo|contas|total)\b/i,
      /\bsaldo total\b/i,
      /\bsaldo das contas\b/i,
    ],
    build: (profileId) => `
      SELECT name, bank, balance
      FROM bank_accounts
      WHERE profile_id = ${profileId} AND is_active = true
      ORDER BY balance DESC
      LIMIT 50
    `.trim(),
  },
  {
    name: "card_spending_current_month",
    patterns: [
      /quanto (?:eu )?gastei (?:este|esse|no) mes/i,
      /gastos (?:do|no|este|esse) mes/i,
      /total gasto (?:este|esse|no) mes/i,
    ],
    build: (profileId) => `
      SELECT
        cc.name AS cartao,
        SUM(ABS(ct.amount)) AS total
      FROM card_transactions ct
      JOIN credit_cards cc ON cc.id = ct.card_id AND cc.profile_id = ${profileId}
      WHERE ct.profile_id = ${profileId}
        AND ct.amount < 0
        AND ct.status = 'active'
        AND EXTRACT(YEAR FROM ct.date) = EXTRACT(YEAR FROM CURRENT_DATE)
        AND EXTRACT(MONTH FROM ct.date) = EXTRACT(MONTH FROM CURRENT_DATE)
      GROUP BY cc.name
      ORDER BY total DESC
      LIMIT 50
    `.trim(),
  },
  {
    name: "spending_by_category_current_month",
    patterns: [
      /total por categoria/i,
      /gastos por categoria/i,
      /quanto gastei por categoria/i,
    ],
    build: (profileId) => `
      SELECT category_name, total_expense
      FROM monthly_category_summary
      WHERE profile_id = ${profileId}
        AND year = EXTRACT(YEAR FROM CURRENT_DATE)::int
        AND month = EXTRACT(MONTH FROM CURRENT_DATE)::int
      ORDER BY total_expense DESC
      LIMIT 50
    `.trim(),
  },
  {
    name: "upcoming_installments",
    patterns: [
      /proximas parcelas/i,
      /parcelas (?:a pagar|pendentes|abertas)/i,
      /quanto falta(?:r)? (?:pagar|das parcelas)/i,
    ],
    build: (profileId) => `
      SELECT
        ci.description,
        cc.name AS cartao,
        ci.total_amount,
        ci.current_installment,
        ci.total_installments,
        (ci.total_installments - ci.current_installment + 1) AS parcelas_restantes,
        ROUND(ci.total_amount / ci.total_installments, 2) AS valor_parcela,
        ROUND((ci.total_amount / ci.total_installments) * (ci.total_installments - ci.current_installment + 1), 2) AS total_restante
      FROM card_installments ci
      JOIN credit_cards cc ON cc.id = ci.card_id AND cc.profile_id = ${profileId}
      WHERE ci.profile_id = ${profileId}
        AND ci.current_installment <= ci.total_installments
      ORDER BY ci.first_installment_date DESC
      LIMIT 50
    `.trim(),
  },
  {
    name: "payable_next_month",
    patterns: [
      /quanto vou pagar (?:no )?proximo mes/i,
      /contas (?:a pagar )?(?:do|no) proximo mes/i,
    ],
    build: (profileId) => `
      SELECT description, amount, due_date, status
      FROM accounts_payable
      WHERE profile_id = ${profileId}
        AND status = 'open'
        AND due_date >= DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month')
        AND due_date <  DATE_TRUNC('month', CURRENT_DATE + INTERVAL '2 month')
      ORDER BY due_date ASC
      LIMIT 100
    `.trim(),
  },
  {
    name: "card_spending_named_current_month",
    patterns: [
      /(?:total )?(?:gasto|gastei) no cart[aã]o\s+([\w\s]+?)(?:\s+(?:este|esse|no) mes)?(?:\?|$)/i,
    ],
    build: (profileId, m) => {
      const name = (m[1] ?? "").trim().replace(/'/g, "''");
      return `
        SELECT
          cc.name AS cartao,
          SUM(ABS(ct.amount)) AS total
        FROM card_transactions ct
        JOIN credit_cards cc ON cc.id = ct.card_id AND cc.profile_id = ${profileId}
        WHERE ct.profile_id = ${profileId}
          AND ct.amount < 0
          AND ct.status = 'active'
          AND (LOWER(cc.name) LIKE LOWER('%${name}%') OR LOWER(cc.brand) LIKE LOWER('%${name}%'))
          AND EXTRACT(YEAR FROM ct.date) = EXTRACT(YEAR FROM CURRENT_DATE)
          AND EXTRACT(MONTH FROM ct.date) = EXTRACT(MONTH FROM CURRENT_DATE)
        GROUP BY cc.name
        LIMIT 10
      `.trim();
    },
  },
  {
    name: "spending_by_category_named",
    patterns: [
      /quanto (?:eu )?gastei (?:com|em)\s+([\w\s]+?)(?:\s+em\s+([\w\s]+?))?(?:\?|$)/i,
    ],
    build: (profileId, m) => {
      const cat = (m[1] ?? "").trim().replace(/'/g, "''");
      const monthWord = (m[2] ?? "").trim().toLowerCase();
      const monthNum = monthWordToNumber(monthWord);
      const monthFilter = monthNum
        ? `AND EXTRACT(MONTH FROM ct.date) = ${monthNum}
           AND EXTRACT(YEAR FROM ct.date) = EXTRACT(YEAR FROM CURRENT_DATE)`
        : `AND EXTRACT(YEAR FROM ct.date) = EXTRACT(YEAR FROM CURRENT_DATE)
           AND EXTRACT(MONTH FROM ct.date) = EXTRACT(MONTH FROM CURRENT_DATE)`;
      return `
        SELECT
          c.name AS categoria,
          SUM(ABS(ct.amount)) AS total
        FROM card_transactions ct
        LEFT JOIN categories c ON c.id = ct.category_id AND c.profile_id = ${profileId}
        WHERE ct.profile_id = ${profileId}
          AND ct.amount < 0
          AND ct.status = 'active'
          AND LOWER(COALESCE(c.name, '')) LIKE LOWER('%${cat}%')
          ${monthFilter}
        GROUP BY c.name
        LIMIT 10
      `.trim();
    },
  },
];

const MONTHS_PT: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

function monthWordToNumber(word: string): number | null {
  if (!word) return null;
  const norm = NORMALIZE(word);
  if (MONTHS_PT[norm] !== undefined) return MONTHS_PT[norm]!;
  const n = Number(norm);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return n;
  return null;
}

export function matchKnownIntent(question: string, profileId: number): KnownIntentMatch | null {
  const norm = NORMALIZE(question);
  for (const intent of INTENTS) {
    for (const re of intent.patterns) {
      const m = norm.match(re) ?? question.match(re);
      if (m) {
        return { sql: intent.build(profileId, m), intent: intent.name };
      }
    }
  }
  return null;
}
