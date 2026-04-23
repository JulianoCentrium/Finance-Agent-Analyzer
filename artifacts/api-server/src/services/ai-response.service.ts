import { openrouterChat } from "../lib/openrouter";

export function formatBRL(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "R$ 0,00";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Sends raw SQL rows back to the LLM and asks it to phrase the answer
 * in Brazilian Portuguese with BRL formatting.
 *
 * Falls back to a simple textual representation of the rows if the LLM
 * is unavailable.
 */
export async function formatAnswer(
  clerkUserId: string,
  question: string,
  rows: Record<string, unknown>[],
): Promise<string> {
  const preview = JSON.stringify(rows.slice(0, 50));

  const systemPrompt = `Você é o CO-Finance, copiloto financeiro pessoal.
Responda em português brasileiro (pt-BR), de forma clara, amigável e concisa.
Formate todos os valores monetários como BRL no padrão R$ X.XXX,XX (ex: R$ 1.234,56).
Quando houver várias linhas, apresente-as como lista ou tabela em texto.
Se o resultado estiver vazio, diga educadamente que não encontrou dados para essa pergunta.
Não invente números: use SOMENTE os dados fornecidos.`;

  const userPrompt = `Pergunta do usuário: "${question}"

Resultado SQL (JSON):
${preview}

Escreva a resposta final ao usuário.`;

  const ai = await openrouterChat(
    clerkUserId,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { maxTokens: 500, temperature: 0.3 },
  );

  if (ai) return ai;

  return fallbackFormat(rows);
}

const MONEY_KEY = /(amount|balance|total|valor|saldo|gasto|limit|paid|received|expense|restante|parcela)/i;

function fallbackFormat(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "Não encontrei dados para essa pergunta.";
  const lines = rows.slice(0, 20).map((r, i) => {
    const parts = Object.entries(r).map(([k, v]) => {
      // Numeric strings (Postgres NUMERIC) → BRL.
      if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v)) {
        return `${k}: ${formatBRL(v)}`;
      }
      // Numeric values: format as BRL when the column name looks monetary.
      if (typeof v === "number") {
        if (MONEY_KEY.test(k)) return `${k}: ${formatBRL(v)}`;
        return `${k}: ${v}`;
      }
      return `${k}: ${v ?? "-"}`;
    });
    return `${i + 1}. ${parts.join(" | ")}`;
  });
  return lines.join("\n");
}
