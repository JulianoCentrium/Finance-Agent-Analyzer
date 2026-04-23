import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeDescription } from "../lib/normalizeDescription.ts";

describe("normalizeDescription", () => {
  it("returns first significant token uppercased", () => {
    assert.equal(normalizeDescription("Netflix.com Streaming"), "NETFLIX");
  });

  it("strips installment markers like 3/12", () => {
    assert.equal(normalizeDescription("Magazine Luiza 3/12"), "MAGAZINE");
    assert.equal(normalizeDescription("Casas Bahia PARC 4/10"), "CASAS");
    assert.equal(normalizeDescription("Loja PARCELA 2/6"), "LOJA");
  });

  it("ignores stopwords and short tokens", () => {
    assert.equal(normalizeDescription("Pagamento de Conta"), "PAGAMENTO");
  });

  it("removes punctuation and collapses spaces", () => {
    assert.equal(normalizeDescription("  AMAZON*BR-MARKETPLACE  "), "AMAZON");
  });

  it("returns empty for blank input", () => {
    assert.equal(normalizeDescription("   "), "");
  });

  it("caps token length to 64 chars", () => {
    const long = "A".repeat(80);
    const out = normalizeDescription(long);
    assert.ok(out.length <= 64);
  });

  it("is deterministic for same input", () => {
    const a = normalizeDescription("Uber Eats Pedido");
    const b = normalizeDescription("Uber Eats Pedido");
    assert.equal(a, b);
  });
});
