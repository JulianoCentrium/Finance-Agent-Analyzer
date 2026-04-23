import { openrouterChat } from "../lib/openrouter";
import {
  buildHeuristic,
  regexMatchesQuestion,
  renderSnippet,
  tryParseLlm,
} from "./intent-suggestion-heuristic";

export interface IntentSuggestion {
  intentName: string;
  regex: string;
  snippet: string;
  source: "llm" | "heuristic";
  /**
   * True when the returned regex actually matches the original question
   * (or its normalized form). The endpoint validates server-side before
   * responding so the admin doesn't have to copy-paste-test a bad regex.
   */
  matchedSample: boolean;
}

const SYSTEM_PROMPT =
  'Você ajuda a criar intents para um copiloto financeiro em português. ' +
  'Dado uma pergunta do usuário, responda APENAS com um JSON válido no formato ' +
  '{"intent_name":"snake_case_curto","regex":"padrão regex case-insensitive sem barras"}. ' +
  'O intent_name deve ter no máximo 4 palavras em snake_case. ' +
  'O regex deve casar variações naturais da pergunta, ignorando acentos e usando \\s+ entre palavras. ' +
  'Não inclua delimitadores /.../ nem flags. Não escreva nada além do JSON.';

export async function suggestIntent(
  clerkUserId: string,
  question: string,
): Promise<IntentSuggestion> {
  const heuristic = buildHeuristic(question);

  const ai = await openrouterChat(
    clerkUserId,
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Pergunta: "${question}"` },
    ],
    { maxTokens: 200, temperature: 0 },
  );

  const parsed = ai ? tryParseLlm(ai) : null;
  if (parsed) {
    if (regexMatchesQuestion(parsed.regex, question)) {
      return {
        intentName: parsed.intentName,
        regex: parsed.regex,
        snippet: renderSnippet(parsed.intentName, parsed.regex),
        source: "llm",
        matchedSample: true,
      };
    }

    // First attempt did not match — ask the LLM to fix it once, telling it
    // exactly which regex failed and which question it needed to match.
    const retry = await openrouterChat(
      clerkUserId,
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            `Pergunta: "${question}"\n\n` +
            `Sua tentativa anterior foi ${JSON.stringify({ intent_name: parsed.intentName, regex: parsed.regex })}, ` +
            `mas o regex NÃO casa com a pergunta acima. ` +
            'Responda novamente APENAS com o JSON no mesmo formato, com um regex que case a pergunta. ' +
            'Use \\s+ entre palavras e não inclua delimitadores nem flags.',
        },
      ],
      { maxTokens: 200, temperature: 0 },
    );
    const reparsed = retry ? tryParseLlm(retry) : null;
    if (reparsed && regexMatchesQuestion(reparsed.regex, question)) {
      return {
        intentName: reparsed.intentName,
        regex: reparsed.regex,
        snippet: renderSnippet(reparsed.intentName, reparsed.regex),
        source: "llm",
        matchedSample: true,
      };
    }
  }

  // Fall back to the deterministic heuristic — by construction it joins
  // keywords pulled from the question, so it should match the normalized
  // form. We still validate to keep `matchedSample` honest.
  return {
    ...heuristic,
    source: "heuristic",
    matchedSample: regexMatchesQuestion(heuristic.regex, question),
  };
}
