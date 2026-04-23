/**
 * Pure helpers for the "Sugerir intent" feature. Kept free of any runtime
 * imports (no DB, no network) so they can be exercised by `node --test`
 * without a TS loader.
 */

const STOPWORDS = new Set([
  "a", "o", "as", "os", "um", "uma", "uns", "umas",
  "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas",
  "para", "pra", "por", "pelo", "pela", "pelos", "pelas",
  "com", "sem", "e", "ou", "que", "qual", "quais", "quanto", "quantos", "quanta", "quantas",
  "meu", "minha", "meus", "minhas", "este", "esse", "esta", "essa", "isso", "isto",
  "foi", "ser", "sou", "tem", "ter", "tive", "tinha",
  "mes", "mês", "ano", "dia", "dias", "semana",
  "hoje", "ontem", "amanha",
]);

export const NORMALIZE = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function pickKeywords(question: string, max = 4): string[] {
  const tokens = NORMALIZE(question).split(" ").filter(Boolean);
  const out: string[] = [];
  for (const t of tokens) {
    if (t.length < 3) continue;
    if (STOPWORDS.has(t)) continue;
    if (out.includes(t)) continue;
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function renderSnippet(intentName: string, regex: string): string {
  return `{
  name: "${intentName}",
  patterns: [/${regex}/i],
  build: (profileId) => \`
    -- TODO: substitua pelo SQL que responde a esta pergunta.
    -- Lembre-se de filtrar TODA tabela por profile_id = \${profileId},
    -- inclusive em JOINs, ou o executor seguro vai rejeitar.
    SELECT 1 WHERE FALSE
  \`.trim(),
},`;
}

export interface HeuristicSuggestion {
  intentName: string;
  regex: string;
  snippet: string;
}

export function buildHeuristic(question: string): HeuristicSuggestion {
  const keywords = pickKeywords(question, 4);
  const fallback = keywords.length === 0 ? ["pergunta", "copiloto"] : keywords;
  const intentName = fallback.slice(0, 3).join("_") || "novo_intent";
  const regex = fallback.map(escapeRegex).join(".*\\s*");
  return { intentName, regex, snippet: renderSnippet(intentName, regex) };
}

/**
 * Returns true when `regex` (case-insensitive) matches either the raw
 * question or its normalized (accent-stripped, punctuation-collapsed) form.
 * A safe wrapper: invalid regexes return false instead of throwing, so the
 * caller can decide to fall back without try/catching.
 */
export function regexMatchesQuestion(regex: string, question: string): boolean {
  if (!regex || !question) return false;
  let re: RegExp;
  try {
    re = new RegExp(regex, "i");
  } catch {
    return false;
  }
  if (re.test(question)) return true;
  if (re.test(NORMALIZE(question))) return true;
  return false;
}

export function sanitizeIntentName(raw: string): string {
  const norm = NORMALIZE(raw).replace(/\s+/g, "_");
  const cleaned = norm.replace(/[^a-z0-9_]/g, "").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return cleaned.slice(0, 60);
}

export function tryParseLlm(text: string): { intentName: string; regex: string } | null {
  const stripped = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as { intent_name?: unknown; regex?: unknown };
    const intentName = sanitizeIntentName(String(parsed.intent_name ?? ""));
    const regex = typeof parsed.regex === "string" ? parsed.regex.trim() : "";
    if (!intentName || !regex) return null;
    try {
      new RegExp(regex, "i");
    } catch {
      return null;
    }
    return { intentName, regex };
  } catch {
    return null;
  }
}
