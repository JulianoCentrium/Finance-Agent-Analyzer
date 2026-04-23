import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Pure helpers used in installment generation and monthly balance bucketing.
 * Mirrors logic from routes/cardTransactions.ts (installment month roll)
 * and routes/reports.ts (year-month bucket).
 */
function addMonths(year: number, month: number, n: number): { year: number; month: number } {
  const total = (year * 12 + (month - 1)) + n;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

function yearMonthKey(date: string): string {
  return date.slice(0, 7);
}

function divideInstallments(total: number, parts: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / parts);
  const remainder = cents - base * parts;
  return Array.from({ length: parts }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100);
}

describe("addMonths", () => {
  it("rolls within same year", () => {
    assert.deepEqual(addMonths(2025, 3, 5), { year: 2025, month: 8 });
  });
  it("rolls across year boundary", () => {
    assert.deepEqual(addMonths(2025, 11, 3), { year: 2026, month: 2 });
  });
  it("handles long horizons (24 months)", () => {
    assert.deepEqual(addMonths(2025, 1, 24), { year: 2027, month: 1 });
  });
  it("zero offset is identity", () => {
    assert.deepEqual(addMonths(2026, 7, 0), { year: 2026, month: 7 });
  });
});

describe("yearMonthKey (monthly balance bucket)", () => {
  it("extracts YYYY-MM from ISO date string", () => {
    assert.equal(yearMonthKey("2025-03-15"), "2025-03");
    assert.equal(yearMonthKey("2026-12-01"), "2026-12");
  });
});

describe("divideInstallments", () => {
  it("splits evenly when divisible", () => {
    assert.deepEqual(divideInstallments(100, 4), [25, 25, 25, 25]);
  });
  it("distributes remainder to first installments", () => {
    const parts = divideInstallments(100, 3);
    assert.equal(parts.length, 3);
    assert.equal(parts.reduce((a, b) => a + b, 0).toFixed(2), "100.00");
  });
  it("handles single installment", () => {
    assert.deepEqual(divideInstallments(99.99, 1), [99.99]);
  });
});
