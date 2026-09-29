import type { Api } from "./api.js";

export type LoginErrorCode =
  | "LOGIN_WINDOW_CLOSED"
  | "LOGIN_NO_RESULT"
  | "LOGIN_DENIED"
  | "LOGIN_STATE_MISMATCH"
  | "LOGIN_NO_CODE"
  | "LOGIN_SERVER_UNREACHABLE"
  | "LOGIN_FAILED"
  | "LOGIN_NOT_CONFIGURED";

export type LoginOutcome =
  | { ok: true }
  | { ok: false; code: LoginErrorCode; message?: string };

export interface Platform {
  api: Api;
  /** Subscribe to be told when the server is newer than this page. */
  onServerChanged(cb: () => void): void;
  boardName: string;
  isMock: boolean;
  getToken(): Promise<string | null>;
  /** Returns an unsubscribe function. */
  onTokenChange(cb: (token: string | null) => void): () => void;
  clearToken(): Promise<void>;
  startLogin(): Promise<LoginOutcome>;
  getActiveWorkspace(): Promise<number | null>;
  setActiveWorkspace(id: number | null): Promise<void>;
}
