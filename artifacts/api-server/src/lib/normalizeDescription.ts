const STOP_WORDS = new Set(["de", "da", "do", "para", "com", "em", "o", "a", "os", "as", "no", "na", "uma", "um", "e"]);

export function normalizeDescription(description: string): string {
  const cleaned = description
    .toUpperCase()
    .replace(/PARC\.?\s*\d+\/\d+|PARCELA\s+\d+\/\d+|\b\d+\/\d+\b/g, "")
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = cleaned.split(" ").filter((t) => t.length >= 3 && !STOP_WORDS.has(t.toLowerCase()));
  return (tokens[0] ?? cleaned).slice(0, 64);
}
