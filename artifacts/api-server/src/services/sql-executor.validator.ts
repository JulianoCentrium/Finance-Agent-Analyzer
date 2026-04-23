/**
 * Pure SQL safety validator for the AI copilot. Has no runtime dependencies
 * (no DB, no @workspace/db) so it can be unit-tested in isolation.
 */

const FORBIDDEN_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "ALTER",
  "CREATE",
  "TRUNCATE",
  "GRANT",
  "REVOKE",
  "MERGE",
  "COPY",
  "VACUUM",
  "REINDEX",
  "COMMENT",
];

/**
 * Allowlist of relations the copilot is permitted to read from. Any other
 * relation referenced via FROM/JOIN/comma is rejected — this is a hard
 * authorization boundary that prevents the LLM from exfiltrating data
 * from non-financial tables (e.g. user_settings holds API keys).
 *
 * Every relation in this list also requires an explicit
 * `<alias>.profile_id = <profileId>` predicate (tenant scoping).
 */
export const ALLOWED_RELATIONS = [
  "bank_accounts",
  "credit_cards",
  "invoices",
  "card_transactions",
  "card_installments",
  "categories",
  "accounts_payable",
  "accounts_receivable",
  "persons",
  "commitment_types",
  "category_rules",
  "ai_query_logs",
  "import_logs",
  "monthly_category_summary",
  "credit_card_summary",
];

/** All allowlisted relations are also tenant-scoped (have a profile_id column). */
export const TENANT_SCOPED_RELATIONS = ALLOWED_RELATIONS;

/**
 * SQL keywords that may appear immediately after a table name when there
 * is no alias. We must NOT treat these as the alias.
 */
const NON_ALIAS_FOLLOWERS = new Set([
  "WHERE", "ON", "USING", "GROUP", "ORDER", "HAVING", "LIMIT", "OFFSET",
  "INNER", "LEFT", "RIGHT", "FULL", "CROSS", "JOIN", "UNION", "INTERSECT",
  "EXCEPT", "AS", "RETURNING", "WITH", "FETCH", "FOR", "WINDOW",
]);

export class UnsafeSqlError extends Error {}

interface TenantReference {
  table: string;
  alias: string;
}

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const FROM_END_KEYWORDS = new Set([
  "WHERE", "GROUP", "ORDER", "HAVING", "LIMIT", "OFFSET", "FETCH",
  "UNION", "INTERSECT", "EXCEPT", "RETURNING", "WINDOW", "FOR",
]);

/**
 * Extract every top-level FROM clause body. Walks the SQL token by token
 * tracking parenthesis depth so that `EXTRACT(YEAR FROM x)` and similar
 * function-internal FROMs are NOT treated as query FROM clauses, and so
 * subquery FROM clauses are skipped (they are validated when the entire
 * SQL is re-scanned recursively below).
 *
 * For copilot SQL we only need to validate the OUTER FROM clauses; any
 * subquery would have to reference an allowed relation too, but since we
 * also scan inside parens, we recurse on each subquery.
 */
function extractFromClauses(sql: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let i = 0;
  const subqueries: string[] = [];

  while (i < sql.length) {
    const ch = sql[i]!;
    if (ch === "(") {
      // Capture the contents of this parenthesized block to recurse later.
      const start = i + 1;
      let d = 1;
      let j = i + 1;
      while (j < sql.length && d > 0) {
        if (sql[j] === "(") d++;
        else if (sql[j] === ")") d--;
        j++;
      }
      subqueries.push(sql.slice(start, j - 1));
      i = j;
      continue;
    }
    if (ch === ")") {
      depth--;
      i++;
      continue;
    }
    if (depth === 0) {
      // Match `FROM` as a word boundary.
      if (
        (i === 0 || /\W/.test(sql[i - 1]!)) &&
        sql.slice(i, i + 4).toUpperCase() === "FROM" &&
        (i + 4 >= sql.length || /\W/.test(sql[i + 4]!))
      ) {
        // Capture from after FROM until the next end keyword at depth 0.
        let j = i + 4;
        let d = 0;
        let bodyStart = j;
        while (j < sql.length) {
          const c = sql[j]!;
          if (c === "(") d++;
          else if (c === ")") d--;
          if (d === 0 && (j === bodyStart || /\W/.test(sql[j - 1]!))) {
            const wordMatch = sql.slice(j).match(/^([A-Za-z_]+)/);
            if (wordMatch && FROM_END_KEYWORDS.has(wordMatch[1]!.toUpperCase())) {
              break;
            }
          }
          j++;
        }
        out.push(sql.slice(bodyStart, j));
        i = j;
        continue;
      }
    }
    i++;
  }

  // Recurse only into parenthesized blocks that look like actual
  // subqueries (start with SELECT or WITH). This avoids treating
  // function bodies like `EXTRACT(YEAR FROM ct.date)` as queries.
  for (const sub of subqueries) {
    if (/^\s*(SELECT|WITH)\b/i.test(sub)) {
      for (const f of extractFromClauses(sub)) out.push(f);
    }
  }
  return out;
}

/**
 * Split a FROM clause into individual table references on commas and
 * JOIN keywords (any flavor: INNER/LEFT/RIGHT/FULL/CROSS JOIN).
 */
function splitFromClause(fromBody: string): string[] {
  // Strip ON ... predicates so JOIN words inside subqueries don't fool us.
  // Also normalize all join variants to a single delimiter "<JOIN>".
  const normalized = fromBody.replace(
    /\b(?:INNER|LEFT|RIGHT|FULL|CROSS)?\s*(?:OUTER\s+)?JOIN\b/gi,
    "<JOIN>",
  );
  return normalized.split(/<JOIN>|,/g).map(s => s.trim()).filter(Boolean);
}

/**
 * Take a single relation segment (e.g. "bank_accounts ba" or
 * "credit_cards AS cc ON cc.id = ct.card_id") and return its
 * { table, alias } tuple, or null if it's a subquery or unparseable.
 */
function parseRelationSegment(seg: string): { table: string; alias: string } | null {
  const trimmed = seg.trim();
  if (trimmed.startsWith("(")) return null; // subquery
  const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_.]*)(?:\s+(?:AS\s+)?([A-Za-z_][A-Za-z0-9_]*))?/i);
  if (!m) return null;
  const rawTable = m[1]!;
  const table = (rawTable.includes(".") ? rawTable.split(".").pop()! : rawTable).toLowerCase();
  const candidate = m[2];
  const isAlias = !!candidate && !NON_ALIAS_FOLLOWERS.has(candidate.toUpperCase());
  return { table, alias: isAlias ? candidate! : table };
}

/**
 * Find every reference to a tenant-scoped relation in any FROM/JOIN/comma
 * position. Returns one entry per reference with its effective alias.
 */
function findTenantReferences(sql: string): TenantReference[] {
  const refs: TenantReference[] = [];
  const tenantSet = new Set(TENANT_SCOPED_RELATIONS.map(s => s.toLowerCase()));
  for (const fromBody of extractFromClauses(sql)) {
    for (const seg of splitFromClause(fromBody)) {
      const parsed = parseRelationSegment(seg);
      if (!parsed) continue;
      if (tenantSet.has(parsed.table)) refs.push(parsed);
    }
  }
  return refs;
}

/**
 * Find the names defined in any WITH (CTE) clauses. These are allowed to
 * appear in FROM/JOIN even though they are not in ALLOWED_RELATIONS.
 */
function findCteNames(sql: string): Set<string> {
  const names = new Set<string>();
  // Match the leading WITH and any subsequent ", name AS ("
  const re = /(?:\bWITH\b(?:\s+RECURSIVE)?|,)\s+([A-Za-z_][A-Za-z0-9_]*)\s+AS\s*\(/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) names.add(m[1]!.toLowerCase());
  return names;
}

/**
 * Find every relation referenced in a FROM/JOIN/comma position.
 * Used by the allowlist check.
 */
function findAllReferencedRelations(sql: string): string[] {
  const out: string[] = [];
  for (const fromBody of extractFromClauses(sql)) {
    for (const seg of splitFromClause(fromBody)) {
      const parsed = parseRelationSegment(seg);
      if (parsed) out.push(parsed.table);
    }
  }
  return out;
}

export function sanitizeAndValidate(rawSql: string, profileId: number, maxRows: number): string {
  if (!Number.isInteger(profileId) || profileId <= 0) {
    throw new UnsafeSqlError("profileId inválido");
  }

  let sql = rawSql.trim();
  while (sql.endsWith(";")) sql = sql.slice(0, -1).trim();

  if (!sql) throw new UnsafeSqlError("SQL vazio");

  if (sql.includes(";")) {
    throw new UnsafeSqlError("Múltiplas instruções SQL não são permitidas");
  }

  if (/--/.test(sql) || /\/\*/.test(sql)) {
    throw new UnsafeSqlError("Comentários SQL não são permitidos");
  }

  if (!/^\s*(SELECT|WITH)\b/i.test(sql)) {
    throw new UnsafeSqlError("Apenas consultas SELECT são permitidas");
  }

  for (const kw of FORBIDDEN_KEYWORDS) {
    if (new RegExp(`\\b${kw}\\b`, "i").test(sql)) {
      throw new UnsafeSqlError(`Palavra-chave proibida: ${kw}`);
    }
  }

  sql = sql.replace(/:profileId\b/g, String(profileId));

  // ---- Allowlist enforcement ----
  // Every relation referenced in FROM/JOIN/comma must be either an
  // allowlisted financial relation or a CTE name defined within this query.
  const cteNames = findCteNames(sql);
  const allowed = new Set(ALLOWED_RELATIONS.map(s => s.toLowerCase()));
  for (const ident of findAllReferencedRelations(sql)) {
    // Strip schema prefix if any (e.g. public.bank_accounts).
    const bare = ident.includes(".") ? ident.split(".").pop()! : ident;
    if (allowed.has(bare)) continue;
    if (cteNames.has(bare)) continue;
    throw new UnsafeSqlError(`Relação não permitida: ${ident}`);
  }

  // ---- Tenant scope enforcement ----
  // For EACH allowlisted reference, require an
  // `<alias>.profile_id = <profileId>` predicate. Single-table queries
  // without an explicit alias may use unqualified `profile_id = <id>`.
  const refs = findTenantReferences(sql);
  if (refs.length > 0) {
    const allowUnqualified = refs.length === 1 && refs[0]!.alias === refs[0]!.table;
    const profileLit = String(profileId);

    for (const { table, alias } of refs) {
      const aliasRe = new RegExp(
        `\\b${escapeForRegex(alias)}\\.profile_id\\s*=\\s*${profileLit}\\b`,
        "i",
      );
      let ok = aliasRe.test(sql);

      if (!ok && alias !== table) {
        const tableRe = new RegExp(
          `\\b${escapeForRegex(table)}\\.profile_id\\s*=\\s*${profileLit}\\b`,
          "i",
        );
        ok = tableRe.test(sql);
      }

      if (!ok && allowUnqualified) {
        const plainRe = new RegExp(
          `(?<![.\\w])profile_id\\s*=\\s*${profileLit}\\b`,
          "i",
        );
        ok = plainRe.test(sql);
      }

      if (!ok) {
        throw new UnsafeSqlError(
          `Filtro de tenant ausente para ${table} (${alias}.profile_id = ${profileLit})`,
        );
      }
    }
  }

  // Enforce LIMIT.
  if (!/\bLIMIT\s+\d+/i.test(sql)) {
    sql = `${sql} LIMIT ${maxRows}`;
  } else {
    sql = sql.replace(/\bLIMIT\s+(\d+)/i, (_, n: string) => {
      const requested = Number(n);
      const safe = Number.isFinite(requested) ? Math.min(requested, maxRows) : maxRows;
      return `LIMIT ${safe}`;
    });
  }

  return sql;
}
