import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const APP = fileURLToPath(new URL("../app/src", import.meta.url));
const require = createRequire(import.meta.url);

// Giao diện dùng chung nằm ngoài extension/ và không có node_modules riêng.
const reactAlias = ["react", "react/jsx-runtime", "react-dom", "react-dom/client"].map((id) => ({
  find: new RegExp(`^${id.replace("/", "\\/")}$`),
  replacement: require.resolve(id),
}));

function manifest(apiBase: string, boardName: string, storeName: string, homepage: string): Plugin {
  return {
    name: "bida-manifest",
    apply: "build",
    generateBundle() {
      const key = JSON.parse(readFileSync("extension-key.json", "utf8")) as { publicKey: string };
      const icons = { "16": "icons/icon-16.png", "48": "icons/icon-48.png", "128": "icons/icon-128.png" };
      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: JSON.stringify(
          {
            manifest_version: 3,
            name: storeName,
            short_name: boardName,
            version: "1.0.0",
            // 132 ký tự là giới hạn của Chrome Web Store
            description:
              "Hệ thống tính điểm và leo rank cho nhóm chơi: bida, cầu lông, cờ. Bảng xếp hạng tự động, đăng nhập bằng Discord.",
            homepage_url: homepage,
            // Khóa cố định: mọi máy cài đều ra cùng một ID, nên redirect URI của Discord không đổi.
            key: key.publicKey,
            icons,
            action: { default_popup: "popup.html", default_icon: icons, default_title: "Bida Ranking" },
            background: { service_worker: "background.js", type: "module" },
            permissions: ["identity", "storage"],
            host_permissions: [`${new URL(apiBase).origin}/*`],
          },
          null,
          2,
        ),
      });
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd());
  if (command === "build") {
    for (const k of ["VITE_API_BASE", "VITE_DISCORD_CLIENT_ID"]) {
      if (!env[k]) throw new Error(`Thiếu ${k} trong extension/.env (xem .env.example)`);
    }
  }
  return {
    plugins: [react(), ...(command === "build" ? [manifest(
                env.VITE_API_BASE!,
                env.VITE_BOARD_NAME?.trim() || "Bảng Xếp Hạng",
                env.VITE_EXTENSION_NAME?.trim() || "Bảng Xếp Hạng — Tính điểm & leo rank",
                env.VITE_HOMEPAGE?.trim() || new URL(env.VITE_API_BASE!).origin,
              )] : [])],
    resolve: { alias: [{ find: /^@app\//, replacement: `${APP}/` }, ...reactAlias] },
    server: { fs: { allow: [APP, "."] } },
    build: {
      rollupOptions: {
        input: { popup: "popup.html", background: "src/background.ts" },
        output: {
          entryFileNames: (chunk) => (chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js"),
        },
      },
    },
  };
});
