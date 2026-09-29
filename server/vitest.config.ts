import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Wiring, not logic: index.ts boots the process and config.ts reads the environment.
      exclude: ["src/index.ts", "src/config.ts", "src/db/schema.ts"],
      reporter: ["text-summary", "lcov"],
      thresholds: { lines: 90, statements: 88, functions: 85, branches: 78 },
    },
    // The integration test files share one database, so they must not run at the same time.
    fileParallelism: false,
  },
});
