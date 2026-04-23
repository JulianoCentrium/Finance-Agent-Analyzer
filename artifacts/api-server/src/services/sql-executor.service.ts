import { pool } from "@workspace/db";
import { sanitizeAndValidate, UnsafeSqlError } from "./sql-executor.validator";

export { sanitizeAndValidate, UnsafeSqlError } from "./sql-executor.validator";

export interface SqlExecutionResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  sql: string;
}

export class SqlExecutionError extends Error {}

/**
 * Validates the SQL is a single read-only SELECT, scoped to profileId,
 * adds a LIMIT if missing, and runs it inside an explicit READ ONLY
 * transaction with a hard statement timeout.
 */
export async function executeSafeSelect(
  rawSql: string,
  profileId: number,
  options: { timeoutMs?: number; maxRows?: number } = {},
): Promise<SqlExecutionResult> {
  const sql = sanitizeAndValidate(rawSql, profileId, options.maxRows ?? 100);
  const timeoutMs = options.timeoutMs ?? 5000;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    try {
      await client.query("SET TRANSACTION READ ONLY");
      await client.query(`SET LOCAL statement_timeout = ${timeoutMs}`);
      const result = await client.query(sql);
      await client.query("COMMIT");
      return {
        rows: result.rows as Record<string, unknown>[],
        rowCount: result.rowCount ?? 0,
        sql,
      };
    } catch (innerErr) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (innerErr instanceof UnsafeSqlError) throw innerErr;
      const msg = innerErr instanceof Error ? innerErr.message : "unknown error";
      throw new SqlExecutionError(msg);
    }
  } finally {
    client.release();
  }
}
