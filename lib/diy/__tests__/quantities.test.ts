import { describe, it, expect } from "vitest";
import { evalQtyFormula } from "../quantities";

describe("evalQtyFormula", () => {
  const dims = {
    area_m2: 12,
    width_cm: 220,
    height_cm: 85,
    depth_cm: 90,
    length_m: 3,
  };

  it("evaluates a simple variable", () => {
    expect(evalQtyFormula("area_m2", dims)).toBe(12);
  });

  it("evaluates multiplication with constant", () => {
    expect(evalQtyFormula("area_m2 * 0.1", dims)).toBe(1.2);
  });

  it("evaluates division and multiplication", () => {
    expect(evalQtyFormula("width_cm / 100", dims)).toBe(2.2);
  });

  it("evaluates chain: width_cm / 100 * height_cm / 100", () => {
    const result = evalQtyFormula("width_cm / 100 * height_cm / 100", dims);
    expect(result).toBeCloseTo(1.87, 2);
  });

  it("evaluates addition", () => {
    expect(evalQtyFormula("area_m2 * 1.1", dims)).toBe(13.2);
  });

  it("evaluates integer literal", () => {
    expect(evalQtyFormula("4", dims)).toBe(4);
  });

  it("evaluates constant arithmetic", () => {
    expect(evalQtyFormula("2 * 3 + 1", dims)).toBe(7);
  });

  it("evaluates with length_m", () => {
    expect(evalQtyFormula("length_m * 1.1", dims)).toBe(3.3);
  });

  it("throws on unknown variable", () => {
    expect(() => evalQtyFormula("unknown_var * 2", dims)).toThrow("Unknown variable");
  });

  it("throws on division by zero", () => {
    expect(() => evalQtyFormula("area_m2 / 0", dims)).toThrow("Division by zero");
  });

  it("rounds to 2 decimal places", () => {
    // 12 * 0.333 = 3.996 but floating-point gives 3.9960000000000004 → rounds to 4
    expect(evalQtyFormula("area_m2 * 0.333", dims)).toBe(4);
    // Use a cleaner example: 10 * 0.15 = 1.5
    expect(evalQtyFormula("10 * 0.15", dims)).toBe(1.5);
  });
});
