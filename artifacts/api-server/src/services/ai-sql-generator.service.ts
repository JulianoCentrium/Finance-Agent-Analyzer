import { openrouterChat } from "../lib/openrouter";
import { DB_SCHEMA_CONTEXT } from "../ai/db-context";

/**
 * Asks the LLM to translate a natural-language question into a single SELECT query.
 * Returns the raw SQL string (without code fences) or null if the LLM is unavailable.
 */
export async function generateSqlFromQuestion(
  clerkUserId: string,
  question: string,
  profileId: number,
): Promise<string | null> {
  const systemPrompt = `Você é um gerador de SQL para PostgreSQL especializado em finanças pessoais.
${DB_SCHEMA_CONTEXT}

PERFIL DO USUÁRIO ATUAL: profile_id = ${profileId}

Responda APENAS com a query SQL pura, sem explicações, sem markdown, sem \`\`\`.
Se a pergunta não puder ser respondida via SQL ou for fora do escopo financeiro, responda exatamente: NO_SQL`;

  const raw = await openrouterChat(
    clerkUserId,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: question },
    ],
    { maxTokens: 400, temperature: 0 },
  );

  if (!raw) return null;
  const cleaned = stripCodeFences(raw).trim();
  if (!cleaned || cleaned.toUpperCase().startsWith("NO_SQL")) return null;
  return cleaned;
}

function stripCodeFences(text: string): string {
  const fenced = text.match(/```(?:sql)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) return fenced[1];
  return text;
}
