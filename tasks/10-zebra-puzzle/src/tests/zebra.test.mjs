import { describe, it, expect } from "vitest";
import { drinksWater, ownsZebra } from "../zebra.mjs";

const NATIONALITIES = ["Englishman", "Spaniard", "Ukrainian", "Norwegian", "Japanese"];

describe("zebra puzzle — public API", () => {
  it("exports drinksWater and ownsZebra as functions", () => {
    expect(typeof drinksWater).toBe("function");
    expect(typeof ownsZebra).toBe("function");
  });

  it("drinksWater() returns one of the five nationalities", () => {
    expect(NATIONALITIES).toContain(drinksWater());
  });

  it("ownsZebra() returns one of the five nationalities", () => {
    expect(NATIONALITIES).toContain(ownsZebra());
  });
});

describe("zebra puzzle — derived solution (canonical answers)", () => {
  it("the water drinker is the Norwegian", () => {
    expect(drinksWater()).toBe("Norwegian");
  });

  it("the zebra owner is the Japanese", () => {
    expect(ownsZebra()).toBe("Japanese");
  });
});

describe("zebra puzzle — purity & stability", () => {
  it("is repeat-stable (same value across many calls)", () => {
    const water = new Set();
    const zebra = new Set();
    for (let i = 0; i < 25; i++) {
      water.add(drinksWater());
      zebra.add(ownsZebra());
    }
    expect(water.size).toBe(1);
    expect(zebra.size).toBe(1);
  });

  it("solves both questions well within the time bound", () => {
    const start = performance.now();
    drinksWater();
    ownsZebra();
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(10000);
  });
});
