import type { Api } from "./api.js";

/** Phần khác nhau giữa web và extension. Giao diện bên trong không biết mình chạy ở đâu. */
export interface Platform {
  api: Api;
  /** Đăng ký nhận báo khi máy chủ có bản mới hơn bản đang mở. */
  onServerChanged(cb: () => void): void;
  boardName: string;
  kind: "web" | "extension";
  isMock: boolean;
  getToken(): Promise<string | null>;
  /** Trả về hàm hủy đăng ký. */
  onTokenChange(cb: (token: string | null) => void): () => void;
  clearToken(): Promise<void>;
  startLogin(): Promise<{ ok: true } | { ok: false; message: string }>;
  getActiveWorkspace(): Promise<number | null>;
  setActiveWorkspace(id: number | null): Promise<void>;
}
