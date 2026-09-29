import { API_BASE, DISCORD_CLIENT_ID, TOKEN_KEY } from "./shared/env.js";
import type { LoginMessage, LoginResponse } from "./shared/messages.js";

// Đăng nhập chạy ở service worker: popup tự đóng khi cửa sổ Discord chiếm focus,
// nếu chạy trong popup thì luồng OAuth sẽ bị cắt giữa chừng.
chrome.runtime.onMessage.addListener((msg: LoginMessage, _sender, sendResponse: (r: LoginResponse) => void) => {
  if (msg?.type !== "login") return false;
  login().then(
    () => sendResponse({ ok: true }),
    (err: unknown) => sendResponse({ ok: false, message: err instanceof Error ? err.message : String(err) }),
  );
  return true; // giữ kênh mở cho sendResponse bất đồng bộ
});

async function login(): Promise<void> {
  const redirectUri = chrome.identity.getRedirectURL("discord");
  const state = crypto.randomUUID();
  const authorize = new URL("https://discord.com/oauth2/authorize");
  authorize.search = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "identify",
    state,
    prompt: "none",
  }).toString();

  let resultUrl: string | undefined;
  try {
    resultUrl = await chrome.identity.launchWebAuthFlow({ url: authorize.toString(), interactive: true });
  } catch {
    throw new Error("Bạn đã đóng cửa sổ Discord trước khi đăng nhập xong.");
  }
  if (!resultUrl) throw new Error("Discord không trả kết quả. Thử lại nhé.");

  const result = new URL(resultUrl);
  if (result.searchParams.get("error") === "access_denied") {
    throw new Error("Bạn đã từ chối cấp quyền trên Discord.");
  }
  if (result.searchParams.get("state") !== state) {
    throw new Error("Phiên đăng nhập không khớp. Thử lại nhé.");
  }
  const code = result.searchParams.get("code");
  if (!code) throw new Error("Discord không trả mã đăng nhập. Thử lại nhé.");

  const res = await fetch(`${API_BASE}/auth/discord`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, redirectUri }),
  }).catch(() => null);
  if (!res) throw new Error("Không kết nối được máy chủ xếp hạng.");
  const data = (await res.json().catch(() => ({}))) as { token?: string; error?: { message?: string } };
  if (!res.ok || !data.token) throw new Error(data.error?.message ?? "Đăng nhập không thành công.");

  await chrome.storage.local.set({ [TOKEN_KEY]: data.token });
}
