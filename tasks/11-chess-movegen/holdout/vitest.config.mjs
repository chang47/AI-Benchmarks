import { defineConfig } from "vitest/config";

// Sequential execution: the perft suite asserts a total wall-clock bound
// (spec criterion 16: whole graded suite < 120 s), so files and tests must
// not run concurrently.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.mjs"],
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
