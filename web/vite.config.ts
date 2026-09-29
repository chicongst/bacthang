import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const APP = fileURLToPath(new URL("../app/src", import.meta.url));
const require = createRequire(import.meta.url);

// The shared UI lives outside web/ and has no node_modules of its own, so pin one React copy here:
// two copies in the same bundle break hooks.
const reactAlias = ["react", "react/jsx-runtime", "react-dom", "react-dom/client"].map((id) => ({
  find: new RegExp(`^${id.replace("/", "\\/")}$`),
  replacement: require.resolve(id),
}));

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd());
  // Kept in step with DEFAULT_BOARD_NAME in app/src/constants.ts; a Vite config cannot import from the app.
  const boardName = env.VITE_BOARD_NAME?.trim() || "Bảng Xếp Hạng";
  if (command === "build" && !env.VITE_DISCORD_CLIENT_ID) {
    throw new Error("VITE_DISCORD_CLIENT_ID is missing from web/.env (see .env.example)");
  }
  return {
    plugins: [
      react(),
      {
        name: "board-name-title",
        transformIndexHtml: (html) => html.replace("__BOARD_NAME__", boardName),
      },
    ],
    resolve: { alias: [{ find: /^@app\//, replacement: `${APP}/` }, ...reactAlias] },
    server: {
      fs: { allow: [APP, "."] },
      // Locally, /api is forwarded to the API on this machine, exactly as Caddy does on the server.
      proxy: {
        "/api": {
          target: env.VITE_DEV_API || "http://localhost:3001",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
