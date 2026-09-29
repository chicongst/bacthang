import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The integration test files share one database, so they must not run at the same time.
    fileParallelism: false,
  },
});
