import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeAndValidate, UnsafeSqlError } from "../services/sql-executor.validator.ts";
import { matchKnownIntent } from "../ai/known-intents.ts";

describe("sql-executor sanitizer", () => {
  it("accepts a basic SELECT against a tenant table and adds LIMIT", () => {
    const out = sanitizeAndValidate(
      "SELECT * FROM bank_accounts WHERE profile_id = :profileId",
      7,
      100,
    );
    assert.match(out, /WHERE profile_id = 7/);
    assert.match(out, /LIMIT 100$/);
  });

  it("accepts a SELECT against no tenant table without scoping", () => {
    const out = sanitizeAndValidate("SELECT NOW() AS now", 1, 50);
    assert.match(out, /LIMIT 50$/);
  });

  it("clamps LIMIT to maxRows", () => {
    const out = sanitizeAndValidate(
      "SELECT * FROM bank_accounts WHERE profile_id = 1 LIMIT 9999",
      1,
      100,
    );
    assert.match(out, /LIMIT 100$/);
  });

  it("rejects DELETE / UPDATE / INSERT", () => {
    assert.throws(() => sanitizeAndValidate("DELETE FROM bank_accounts", 1, 100), UnsafeSqlError);
    assert.throws(() => sanitizeAndValidate("UPDATE bank_accounts SET balance=0", 1, 100), UnsafeSqlError);
    assert.throws(() => sanitizeAndValidate("INSERT INTO bank_accounts VALUES (1)", 1, 100), UnsafeSqlError);
  });

  it("rejects DROP/ALTER/TRUNCATE", () => {
    assert.throws(() => sanitizeAndValidate("DROP TABLE bank_accounts", 1, 100), UnsafeSqlError);
    assert.throws(() => sanitizeAndValidate("ALTER TABLE x ADD COLUMN y INT", 1, 100), UnsafeSqlError);
    assert.throws(() => sanitizeAndValidate("TRUNCATE bank_accounts", 1, 100), UnsafeSqlError);
  });

  it("rejects multi-statement injection", () => {
    assert.throws(
      () => sanitizeAndValidate("SELECT 1; DROP TABLE bank_accounts", 1, 100),
      UnsafeSqlError,
    );
  });

  it("rejects SQL comments to prevent hiding tokens", () => {
    assert.throws(
      () => sanitizeAndValidate("SELECT * FROM bank_accounts WHERE profile_id = 1 -- DROP TABLE x", 1, 100),
      UnsafeSqlError,
    );
    assert.throws(
      () => sanitizeAndValidate("SELECT * FROM bank_accounts /* DROP */ WHERE profile_id = 1", 1, 100),
      UnsafeSqlError,
    );
  });

  it("accepts WITH (CTE) queries when tenant-scoped", () => {
    const out = sanitizeAndValidate(
      "WITH x AS (SELECT * FROM bank_accounts WHERE profile_id = 1) SELECT * FROM x",
      1,
      100,
    );
    assert.match(out, /^WITH/);
  });

  // ---- Tenant scope enforcement (the critical access-control checks) ----

  it("rejects SELECT against tenant table missing profile_id filter", () => {
    assert.throws(
      () => sanitizeAndValidate("SELECT * FROM bank_accounts", 7, 100),
      UnsafeSqlError,
    );
  });

  it("rejects SELECT with profile_id filter for the WRONG tenant id", () => {
    assert.throws(
      () => sanitizeAndValidate("SELECT * FROM bank_accounts WHERE profile_id = 99", 7, 100),
      UnsafeSqlError,
    );
  });

  it("rejects JOIN where one tenant table lacks a profile_id filter", () => {
    // card_transactions filtered, credit_cards JOIN unscoped → must reject
    assert.throws(
      () =>
        sanitizeAndValidate(
          "SELECT cc.name, ct.amount FROM card_transactions ct " +
            "JOIN credit_cards cc ON cc.id = ct.card_id " +
            "WHERE ct.profile_id = 7",
          7,
          100,
        ),
      UnsafeSqlError,
    );
  });

  it("accepts JOIN where every tenant table has a profile_id filter", () => {
    const out = sanitizeAndValidate(
      "SELECT cc.name, ct.amount FROM card_transactions ct " +
        "JOIN credit_cards cc ON cc.id = ct.card_id AND cc.profile_id = 7 " +
        "WHERE ct.profile_id = 7",
      7,
      100,
    );
    assert.match(out, /LIMIT 100$/);
  });

  it("rejects duplicated predicate on one alias when another tenant table is unscoped", () => {
    // Adversarial: two profile_id=7 filters BUT both are on `ct`; cc is unscoped.
    assert.throws(
      () =>
        sanitizeAndValidate(
          "SELECT * FROM card_transactions ct " +
            "JOIN credit_cards cc ON cc.id = ct.card_id " +
            "WHERE ct.profile_id = 7 AND ct.profile_id = 7",
          7,
          100,
        ),
      UnsafeSqlError,
    );
  });

  it("rejects when alias has predicate but joined fully-qualified table doesn't", () => {
    assert.throws(
      () =>
        sanitizeAndValidate(
          "SELECT * FROM card_transactions ct, credit_cards " +
            "WHERE ct.profile_id = 7 AND ct.card_id = credit_cards.id",
          7,
          100,
        ),
      UnsafeSqlError,
    );
  });

  it("accepts implicit-join when both tables qualify with profile_id", () => {
    const out = sanitizeAndValidate(
      "SELECT * FROM card_transactions ct, credit_cards cc " +
        "WHERE ct.profile_id = 7 AND cc.profile_id = 7 AND ct.card_id = cc.id",
      7,
      100,
    );
    assert.match(out, /LIMIT 100$/);
  });

  // ---- Allowlist enforcement ----

  it("rejects access to non-allowlisted sensitive tables (user_settings)", () => {
    assert.throws(
      () => sanitizeAndValidate("SELECT * FROM user_settings WHERE profile_id = 7", 7, 100),
      UnsafeSqlError,
    );
  });

  it("rejects access to system tables", () => {
    assert.throws(
      () => sanitizeAndValidate("SELECT * FROM pg_user", 7, 100),
      UnsafeSqlError,
    );
    assert.throws(
      () => sanitizeAndValidate("SELECT * FROM information_schema.tables", 7, 100),
      UnsafeSqlError,
    );
  });

  it("rejects JOIN that pulls a non-allowlisted table alongside an allowed one", () => {
    assert.throws(
      () =>
        sanitizeAndValidate(
          "SELECT * FROM bank_accounts ba JOIN user_settings us ON us.profile_id = ba.profile_id WHERE ba.profile_id = 7",
          7,
          100,
        ),
      UnsafeSqlError,
    );
  });

  it("rejects access to profiles table (not in allowlist)", () => {
    assert.throws(
      () => sanitizeAndValidate("SELECT * FROM profiles WHERE id = 7", 7, 100),
      UnsafeSqlError,
    );
  });

  it("accepts CTE name that is not in allowlist", () => {
    const out = sanitizeAndValidate(
      "WITH totals AS (SELECT * FROM bank_accounts WHERE profile_id = 7) SELECT * FROM totals",
      7,
      100,
    );
    assert.match(out, /^WITH/);
  });

  it("rejects invalid profileId argument", () => {
    assert.throws(() => sanitizeAndValidate("SELECT 1", 0, 100), UnsafeSqlError);
    assert.throws(() => sanitizeAndValidate("SELECT 1", -3, 100), UnsafeSqlError);
    assert.throws(() => sanitizeAndValidate("SELECT 1", 1.5, 100), UnsafeSqlError);
  });
});

describe("known-intents tenant scoping", () => {
  // Every built-in template must pass the sanitizer for its own profileId.
  const profileId = 42;
  const questions = [
    "Qual meu saldo?",
    "Saldo da conta Nubank?",
    "Quanto gastei este mês?",
    "Total por categoria?",
    "Próximas parcelas?",
    "Quanto vou pagar no próximo mês?",
    "Quanto gastei no cartão Visa este mês?",
    "Quanto gastei com Alimentação em Março?",
  ];

  for (const q of questions) {
    it(`intent for "${q}" passes the sanitizer`, () => {
      const match = matchKnownIntent(q, profileId);
      assert.ok(match, `expected a known intent for: ${q}`);
      const sql = sanitizeAndValidate(match!.sql, profileId, 100);
      assert.match(sql, new RegExp(`profile_id = ${profileId}`));
    });
  }
});
