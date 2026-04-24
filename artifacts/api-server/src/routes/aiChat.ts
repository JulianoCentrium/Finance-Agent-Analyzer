import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/authMiddleware";
import { db, aiQueryLogsTable } from "@workspace/db";
import { assertProfileOwnership, type AuthRequest } from "../lib/auth";
import { getOpenrouterKey } from "../lib/openrouter";
import { matchKnownIntent } from "../ai/known-intents";
import { generateSqlFromQuestion } from "../services/ai-sql-generator.service";
import { executeSafeSelect, UnsafeSqlError, SqlExecutionError } from "../services/sql-executor.service";
import { formatAnswer } from "../services/ai-response.service";
import { logger } from "../lib/logger";

const router: IRouter = Router();

type ChatMessage = { role: "user" | "assistant"; content: string };

async function logQuery(params: {
  profileId: number;
  question: string;
  sql: string | null;
  intent: string | null;
  success: boolean;
  errorMessage?: string;
}) {
  try {
    await db.insert(aiQueryLogsTable).values({
      profileId: params.profileId,
      question: params.question,
      sqlGenerated: params.sql,
      intent: params.intent,
      success: params.success ? "true" : "false",
      errorMessage: params.errorMessage ?? null,
    });
  } catch (err) {
    logger.warn({ err }, "Failed to persist ai_query_logs entry");
  }
}

router.post("/ai/chat", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const { profileId, messages, devMode } = req.body as { profileId: unknown; messages: unknown; devMode?: unknown };
  const includeSql = devMode === true;

  if (!profileId || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "profileId e messages são obrigatórios" });
    return;
  }

  const numProfileId = Number(profileId);
  if (isNaN(numProfileId)) {
    res.status(400).json({ error: "profileId inválido" });
    return;
  }

  if (!(await assertProfileOwnership(res, clerkUserId, numProfileId))) return;

  const lastUserMessage = [...(messages as ChatMessage[])].reverse().find(m => m.role === "user");
  if (!lastUserMessage?.content?.trim()) {
    res.status(400).json({ error: "Pergunta vazia" });
    return;
  }
  const question = lastUserMessage.content.trim();

  const { apiKey } = await getOpenrouterKey(clerkUserId);

  // Step 1: try a known parameterized intent first (fast path, no LLM SQL gen).
  const known = matchKnownIntent(question, numProfileId);

  let sql: string | null = known?.sql ?? null;
  let intent: string | null = known?.intent ?? null;

  // Step 2: if no known intent, ask the LLM to generate SQL (requires OpenRouter key).
  if (!sql) {
    if (!apiKey) {
      await logQuery({
        profileId: numProfileId,
        question,
        sql: null,
        intent: null,
        success: false,
        errorMessage: "missing_openrouter_key",
      });
      res.json({
        reply:
          "O copiloto IA está em modo de demonstração. Para responder perguntas livres, configure sua chave do OpenRouter.ai em Configurações. " +
          "Enquanto isso, posso responder perguntas comuns como: \"Qual meu saldo?\", \"Quanto gastei este mês?\", \"Próximas parcelas?\", \"Total por categoria?\".",
      });
      return;
    }
    try {
      sql = await generateSqlFromQuestion(clerkUserId, question, numProfileId);
    } catch (err) {
      logger.error({ err }, "SQL generation failed");
      sql = null;
    }
    intent = "llm_generated";
  }

  if (!sql) {
    await logQuery({
      profileId: numProfileId,
      question,
      sql: null,
      intent,
      success: false,
      errorMessage: "no_sql_generated",
    });
    res.json({
      reply:
        "Desculpe, não consegui transformar essa pergunta em uma consulta financeira. Tente reformular ou usar uma das sugestões rápidas.",
    });
    return;
  }

  // Step 3: execute safely.
  let rows: Record<string, unknown>[] = [];
  let executedSql = sql;
  try {
    const result = await executeSafeSelect(sql, numProfileId, { timeoutMs: 5000, maxRows: 100 });
    rows = result.rows;
    executedSql = result.sql;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    const isUnsafe = err instanceof UnsafeSqlError;
    const isExec = err instanceof SqlExecutionError;
    logger.warn({ err, sql }, "SQL execution rejected/failed");
    await logQuery({
      profileId: numProfileId,
      question,
      sql,
      intent,
      success: false,
      errorMessage: msg,
    });
    res.json({
      reply: isUnsafe
        ? "Não posso executar essa consulta por motivos de segurança. Apenas leituras (SELECT) são permitidas."
        : isExec
          ? "Tive um problema ao consultar seus dados financeiros. Tente reformular a pergunta."
          : "Erro inesperado ao processar sua pergunta.",
    });
    return;
  }

  // Step 4: format answer in pt-BR using the LLM (or fallback if no key).
  const reply = await formatAnswer(clerkUserId, question, rows);

  await logQuery({
    profileId: numProfileId,
    question,
    sql: executedSql,
    intent,
    success: true,
  });

  res.json({
    reply,
    rowCount: rows.length,
    intent,
    rows,
    ...(includeSql ? { sql: executedSql } : {}),
  });
});

export default router;
