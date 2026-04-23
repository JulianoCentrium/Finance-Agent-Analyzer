import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildHeuristic,
  pickKeywords,
  regexMatchesQuestion,
  sanitizeIntentName,
  tryParseLlm,
} from "../ai/intent-suggestion-heuristic.ts";

describe("intent-suggestion heuristic", () => {
  it("picks significant tokens, dropping stopwords and accents", () => {
    const kws = pickKeywords("Quanto eu gastei com mercado este mês?");
    assert.deepEqual(kws, ["gastei", "mercado"]);
  });

  it("builds a snake_case intent name from keywords", () => {
    const s = buildHeuristic("Quanto gastei com Uber?");
    assert.match(s.intentName, /^[a-z0-9_]+$/);
    assert.ok(s.intentName.includes("gastei"));
  });

  it("produces a regex that matches the original question", () => {
    const s = buildHeuristic("Quanto gastei com mercado?");
    const re = new RegExp(s.regex, "i");
    assert.ok(re.test("quanto gastei com mercado"));
  });

  it("escapes regex metacharacters in tokens", () => {
    const s = buildHeuristic("relatorio de a+b vendas");
    new RegExp(s.regex, "i");
  });

  it("emits a snippet referencing INTENTS shape (name, patterns, build)", () => {
    const s = buildHeuristic("saldo do banco itau");
    assert.match(s.snippet, /name:/);
    assert.match(s.snippet, /patterns:/);
    assert.match(s.snippet, /build:/);
    assert.match(s.snippet, /profile_id/);
  });

  it("falls back to a default name when nothing significant remains", () => {
    const s = buildHeuristic("?");
    assert.ok(s.intentName.length > 0);
  });
});

describe("intent-suggestion sanitizers", () => {
  it("sanitizeIntentName forces snake_case ascii", () => {
    assert.equal(sanitizeIntentName("Saldo Conta Itaú!!"), "saldo_conta_itau");
  });

  it("tryParseLlm parses fenced JSON and validates regex", () => {
    const out = tryParseLlm('```json\n{"intent_name":"foo_bar","regex":"foo\\\\s+bar"}\n```');
    assert.ok(out);
    assert.equal(out!.intentName, "foo_bar");
    new RegExp(out!.regex, "i");
  });

  it("tryParseLlm rejects invalid regex", () => {
    const out = tryParseLlm('{"intent_name":"x","regex":"["}');
    assert.equal(out, null);
  });

  it("tryParseLlm rejects missing fields", () => {
    assert.equal(tryParseLlm('{"intent_name":"x"}'), null);
    assert.equal(tryParseLlm("not json at all"), null);
  });
});

describe("regexMatchesQuestion", () => {
  it("matches the original question case-insensitively", () => {
    assert.equal(regexMatchesQuestion("gastei\\s+com\\s+mercado", "Quanto Gastei com Mercado?"), true);
  });

  it("matches against the accent-stripped/normalized form", () => {
    // regex has no accent, question does
    assert.equal(regexMatchesQuestion("saldo.*itau", "Qual o saldo do Itaú?"), true);
  });

  it("returns false when the regex does not match the question", () => {
    assert.equal(regexMatchesQuestion("uber", "Quanto gastei com mercado?"), false);
  });

  it("returns false (instead of throwing) for invalid regex", () => {
    assert.equal(regexMatchesQuestion("[unterminated", "qualquer coisa"), false);
  });

  it("returns false for empty inputs", () => {
    assert.equal(regexMatchesQuestion("", "x"), false);
    assert.equal(regexMatchesQuestion("x", ""), false);
  });

  it("the heuristic regex always matches the question that produced it", () => {
    for (const q of [
      "Quanto gastei com mercado este mês?",
      "Saldo do banco Itaú",
      "relatorio de a+b vendas",
    ]) {
      const s = buildHeuristic(q);
      assert.equal(regexMatchesQuestion(s.regex, q), true, `failed for: ${q}`);
    }
  });
});
