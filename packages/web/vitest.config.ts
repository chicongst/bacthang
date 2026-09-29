import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const APP = fileURLToPath(new URL("../app/src", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: [{ find: /^@app\//, replacement: `${APP}/` }] },
  test: {
    // e2e/ belongs to Playwright; vitest would try to run it and fail on the import.
    include: ["test/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    css: false,
  },
});
