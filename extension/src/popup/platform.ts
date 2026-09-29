import { createApi } from "@app/api.js";
import type { Platform } from "@app/platform.js";
import type { LoginResponse } from "../shared/messages.js";
import { API_BASE, BOARD_NAME, TOKEN_KEY } from "../shared/env.js";

const ACTIVE_KEY = "ranking.activeWorkspace";
const MOCK = import.meta.env.DEV && new URLSearchParams(location.search).has("mock");

let serverChanged: (() => void) | null = null;
const api = createApi(API_BASE, { mock: MOCK, onServerChanged: () => serverChanged?.() });

export const chromePlatform: Platform = {
  api,
  onServerChanged: (cb) => {
    serverChanged = cb;
  },
  boardName: BOARD_NAME,
  kind: "extension",
  isMock: MOCK,

  async getToken() {
    if (MOCK) return "mock";
    return ((await chrome.storage.local.get(TOKEN_KEY))[TOKEN_KEY] as string | undefined) ?? null;
  },
  onTokenChange(cb) {
    if (MOCK) return () => undefined;
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && TOKEN_KEY in changes) cb((changes[TOKEN_KEY]!.newValue as string | undefined) ?? null);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  },
  async clearToken() {
    if (!MOCK) await chrome.storage.local.remove(TOKEN_KEY);
  },
  async startLogin(): Promise<LoginResponse> {
    // Chạy ở service worker: popup tự đóng khi cửa sổ Discord chiếm focus.
    if (MOCK) return { ok: true };
    return chrome.runtime.sendMessage({ type: "login" });
  },
  async getActiveWorkspace() {
    if (MOCK) return 1;
    return ((await chrome.storage.local.get(ACTIVE_KEY))[ACTIVE_KEY] as number | undefined) ?? null;
  },
  async setActiveWorkspace(id) {
    if (MOCK) return;
    if (id === null) await chrome.storage.local.remove(ACTIVE_KEY);
    else await chrome.storage.local.set({ [ACTIVE_KEY]: id });
  },
};
