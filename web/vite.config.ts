import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const APP = fileURLToPath(new URL("../app/src", import.meta.url));
const require = createRequire(import.meta.url);

// Giao diện dùng chung nằm ngoài web/ và không có node_modules riêng, nên phải chỉ rõ
// React nằm ở đâu — nếu để lẫn hai bản React thì hook sẽ hỏng.
const reactAlias = ["react", "react/jsx-runtime", "react-dom", "react-dom/client"].map((id) => ({
  find: new RegExp(`^${id.replace("/", "\\/")}$`),
  replacement: require.resolve(id),
}));

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd());
  const boardName = env.VITE_BOARD_NAME?.trim() || "Bảng Xếp Hạng";
  if (command === "build" && !env.VITE_DISCORD_CLIENT_ID) {
    throw new Error("Thiếu VITE_DISCORD_CLIENT_ID trong web/.env (xem .env.example)");
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
      // Chạy ở máy thì /api được chuyển tiếp sang API cục bộ, giống hệt cách Caddy làm trên server.
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
