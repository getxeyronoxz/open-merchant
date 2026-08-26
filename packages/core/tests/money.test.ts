import { describe, expect, it } from "vitest";

import { Decimal, MoneyError, formatAmount, parseAmount, roundAmount } from "../src/money";

describe("parseAmount", () => {
  it("accepts amounts with zero to two fractional digits", () => {
    expect(parseAmount("1250").toFixed(2)).toBe("1250.00");
    expect(parseAmount("1250.5").toString()).toBe("1250.5");
    expect(parseAmount("-12.25").toString()).toBe("-12.25");
    expect(parseAmount("0").isZero()).toBe(true);
  });

  it("rejects excess precision, separators, exponents, and junk", () => {
    for (const bad of ["1250.500", "1,250", "1e3", "", "abc", "--4", "4.", ".5"]) {
      expect(() => parseAmount(bad)).toThrow(MoneyError);
    }
  });
});

describe("formatAmount", () => {
  it("always emits exactly two fractional digits", () => {
    expect(formatAmount(new Decimal("0"))).toBe("0.00");
    expect(formatAmount(new Decimal("1250"))).toBe("1250.00");
    expect(formatAmount(new Decimal("-0.5"))).toBe("-0.50");
    expect(formatAmount(new Decimal("124.99875"))).toBe("125.00");
  });
});

describe("roundAmount", () => {
  it("rounds ties away from zero, matching the legacy engine", () => {
    expect(roundAmount(new Decimal("2.675")).toFixed(2)).toBe("2.68");
    expect(roundAmount(new Decimal("-2.675")).toFixed(2)).toBe("-2.68");
    expect(roundAmount(new Decimal("2.674")).toFixed(2)).toBe("2.67");
    expect(roundAmount(new Decimal("-2.674")).toFixed(2)).toBe("-2.67");
  });
});

describe("exact arithmetic through a full fee computation", () => {
  it("computes a marketplace fee the way the legacy Rust engine did", () => {
    const price = parseAmount("999.99");
    const rate = parseAmount("12.5");
    const fee = price.times(rate).dividedBy(100);
    expect(fee.toString()).toBe("124.99875");
    expect(formatAmount(roundAmount(fee))).toBe("125.00");
  });

  it("never accumulates float error across repeated addition", () => {
    let sum = new Decimal(0);
    for (let index = 0; index < 100; index += 1) {
      sum = sum.plus("0.01");
    }
    expect(sum.toFixed(2)).toBe("1.00");
  });
});
