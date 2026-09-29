import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const APP = fileURLToPath(new URL("../app/src", import.meta.url));
const require = createRequire(import.meta.url);

const reactAlias = ["react", "react/jsx-runtime", "react/jsx-dev-runtime", "react-dom", "react-dom/client"].map((id) => ({
  find: new RegExp(`^${id.replace("/", "\\/")}$`),
  replacement: require.resolve(id),
}));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: [{ find: /^@app\//, replacement: `${APP}/` }, ...reactAlias] },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    css: false,
  },
});
