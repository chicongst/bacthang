import { createApi } from "@app/api.js";
import type { Platform } from "@app/platform.js";

const TOKEN_KEY = "ranking.token";
const ACTIVE_KEY = "ranking.activeWorkspace";
const STATE_KEY = "ranking.oauthState";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || "/api";
const CLIENT_ID = (import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined) ?? "";
const BOARD_NAME = (import.meta.env.VITE_BOARD_NAME as string | undefined)?.trim() || "Bảng Xếp Hạng";
const MOCK = import.meta.env.DEV && new URLSearchParams(location.search).has("mock");

/** Discord ID là một dãy số 17–20 chữ số. Giá trị khác nghĩa là chưa cấu hình xong. */
const CLIENT_ID_OK = /^\d{17,20}$/.test(CLIENT_ID);

/** Discord bắt redirect URI khớp tuyệt đối, nên luôn dùng gốc trang kèm dấu / ở cuối. */
export const REDIRECT_URI = `${location.origin}/`;

let serverChanged: (() => void) | null = null;
const api = createApi(API_BASE, { mock: MOCK, onServerChanged: () => serverChanged?.() });

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* chế độ riêng tư của trình duyệt có thể chặn */
  }
};

export interface LoginResult {
  token?: string;
  error?: string;
}

/** Gọi một lần lúc trang mở, để nhận kết quả Discord chuyển hướng về. */
export async function consumeDiscordRedirect(): Promise<LoginResult> {
  const url = new URL(location.href);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  if (!code && !error) return {};

  const expected = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  const clean = () => history.replaceState(null, "", url.pathname);

  if (error) {
    clean();
    return { error: error === "access_denied" ? "Bạn đã từ chối cấp quyền trên Discord." : "Đăng nhập Discord không thành công." };
  }
  if (!state || state !== expected) {
    clean();
    return { error: "Phiên đăng nhập không khớp. Thử lại nhé." };
  }
  try {
    const token = await api.exchangeDiscordCode(code!, REDIRECT_URI);
    write(TOKEN_KEY, token);
    clean();
    return { token };
  } catch (e) {
    clean();
    return { error: e instanceof Error ? e.message : "Đăng nhập không thành công." };
  }
}

export function createWebPlatform(onLoginError: (msg: string) => void): Platform {
  const listeners = new Set<(t: string | null) => void>();

  return {
    api,
    onServerChanged: (cb) => {
      serverChanged = cb;
    },
    boardName: BOARD_NAME,
    kind: "web",
    isMock: MOCK,

    async getToken() {
      return MOCK ? "mock" : read(TOKEN_KEY);
    },
    onTokenChange(cb) {
      listeners.add(cb);
      // Đăng nhập hoặc đăng xuất ở tab khác cũng phải có hiệu lực ở tab này.
      const onStorage = (e: StorageEvent) => {
        if (e.key === TOKEN_KEY) cb(e.newValue);
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", onStorage);
      };
    },
    async clearToken() {
      write(TOKEN_KEY, null);
      listeners.forEach((cb) => cb(null));
    },

    async startLogin() {
      if (MOCK) return { ok: true };
      if (!CLIENT_ID_OK) {
        const message =
          "Trang chưa được cấu hình Discord. Người quản trị cần điền DISCORD_CLIENT_ID và DISCORD_CLIENT_SECRET rồi dựng lại.";
        onLoginError(message);
        return { ok: false, message };
      }
      const state = crypto.randomUUID();
      sessionStorage.setItem(STATE_KEY, state);
      const authorize = new URL("https://discord.com/oauth2/authorize");
      authorize.search = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: "code",
        redirect_uri: REDIRECT_URI,
        scope: "identify",
        state,
        prompt: "none",
      }).toString();
      location.assign(authorize.toString());
      // Trang đang rời đi; promise này không bao giờ trả về.
      return new Promise<{ ok: true }>(() => {});
    },

    async getActiveWorkspace() {
      if (MOCK) return 1;
      const raw = read(ACTIVE_KEY);
      return raw ? Number(raw) : null;
    },
    async setActiveWorkspace(id) {
      if (MOCK) return;
      write(ACTIVE_KEY, id === null ? null : String(id));
    },
  };
}

export function setToken(token: string) {
  write(TOKEN_KEY, token);
}
