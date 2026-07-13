// Holdout tests — mechanical translation of holdout/canonical-data.json
// Source: https://raw.githubusercontent.com/exercism/problem-specifications/main/exercises/zebra-puzzle/canonical-data.json
// Each `it` maps 1:1 to a canonical case: name = case description,
// call = case property, assertion = case expected. Nothing added, nothing adapted.

import { describe, it, expect } from "vitest";
import { drinksWater, ownsZebra } from "../../src/zebra.mjs";

describe("zebra-puzzle", () => {
  // uuid 16efb4e4-8ad7-4d5e-ba96-e5537b66fd42
  it("resident who drinks water", () => {
    expect(drinksWater()).toBe("Norwegian");
  });

  // uuid 084d5b8b-24e2-40e6-b008-c800da8cd257
  it("resident who owns zebra", () => {
    expect(ownsZebra()).toBe("Japanese");
  });
});
