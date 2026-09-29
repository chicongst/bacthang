import { createApi } from "@app/api.js";
import { DEFAULT_BOARD_NAME } from "@app/constants.js";
import type { LoginErrorCode, Platform } from "@app/platform.js";

const TOKEN_KEY = "ranking.token";
const ACTIVE_KEY = "ranking.activeWorkspace";
const STATE_KEY = "ranking.oauthState";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || "/api";
const CLIENT_ID = (import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined) ?? "";
const BOARD_NAME = (import.meta.env.VITE_BOARD_NAME as string | undefined)?.trim() || DEFAULT_BOARD_NAME;
const MOCK = import.meta.env.DEV && new URLSearchParams(location.search).has("mock");

/** A Discord ID is 17 to 20 digits. Anything else means the app is not configured yet. */
const CLIENT_ID_OK = /^\d{17,20}$/.test(CLIENT_ID);

/** Discord matches redirect URIs exactly, so always use the page origin with a trailing slash. */
const REDIRECT_URI = `${location.origin}/`;

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
    /* private browsing may block storage */
  }
};

export interface LoginResult {
  token?: string;
  error?: LoginErrorCode;
}

/** Call once on page load to pick up the result Discord redirected back with. */
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
    return { error: error === "access_denied" ? "LOGIN_DENIED" : "LOGIN_FAILED" };
  }
  if (!state || state !== expected) {
    clean();
    return { error: "LOGIN_STATE_MISMATCH" };
  }
  try {
    const token = await api.exchangeDiscordCode(code!, REDIRECT_URI);
    write(TOKEN_KEY, token);
    clean();
    return { token };
  } catch {
    clean();
    return { error: "LOGIN_FAILED" };
  }
}

export function createWebPlatform(onLoginError: (code: LoginErrorCode) => void): Platform {
  const listeners = new Set<(t: string | null) => void>();

  return {
    api,
    onServerChanged: (cb) => {
      serverChanged = cb;
    },
    boardName: BOARD_NAME,
    isMock: MOCK,

    async getToken() {
      return MOCK ? "mock" : read(TOKEN_KEY);
    },
    onTokenChange(cb) {
      listeners.add(cb);
      // Signing in or out in another tab must take effect here too.
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
        onLoginError("LOGIN_NOT_CONFIGURED");
        return { ok: false, code: "LOGIN_NOT_CONFIGURED" };
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
      // The page is navigating away; this promise never settles.
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

