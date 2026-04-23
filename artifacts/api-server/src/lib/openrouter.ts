import { eq } from "drizzle-orm";
import { db, userSettingsTable } from "@workspace/db";

export async function getOpenrouterKey(clerkUserId: string): Promise<{ apiKey: string | null; model: string }> {
  const [row] = await db
    .select()
    .from(userSettingsTable)
    .where(eq(userSettingsTable.clerkUserId, clerkUserId));
  return {
    apiKey: row?.openrouterApiKey ?? null,
    model: row?.openrouterModel ?? "openai/gpt-4o-mini",
  };
}

export function maskKey(key: string | null): string | null {
  if (!key) return null;
  if (key.length <= 8) return "•".repeat(key.length);
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

/** Single-shot completion against OpenRouter. Returns trimmed text or null. */
export async function openrouterChat(
  clerkUserId: string,
  messages: ChatMessage[],
  options: { maxTokens?: number; temperature?: number } = {},
): Promise<string | null> {
  const { apiKey, model } = await getOpenrouterKey(clerkUserId);
  if (!apiKey) return null;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: options.maxTokens ?? 64,
        temperature: options.temperature ?? 0,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}
