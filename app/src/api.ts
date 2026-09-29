import type { Account, Board, Member, RecentMatch, SearchResult } from "./types.js";

export class ApiError extends Error {
  constructor(readonly code: string, readonly status: number, message: string) {
    super(message);
  }
}

export type Api = ReturnType<typeof createApi>;

// Viết dạng này để bundler thấy `import.meta.env.DEV` là false lúc build và bỏ hẳn file mock đi.
const loadMock = () =>
  import.meta.env.DEV ? import("./mock.js") : Promise.reject(new Error("mock chỉ có khi chạy dev"));

export interface ApiOptions {
  mock?: boolean;
  /** Gọi khi máy chủ báo một phiên bản khác với phiên bản thấy lần đầu, tức vừa có deploy mới. */
  onServerChanged?: () => void;
}

export function createApi(baseUrl: string, options: ApiOptions = {}) {
  const useMock = options.mock ?? false;
  let seenVersion: string | null = null;

  function checkVersion(res: Response): void {
    const version = res.headers.get("x-app-version");
    if (!version) return;
    if (seenVersion === null) seenVersion = version;
    else if (seenVersion !== version) options.onServerChanged?.();
  }

  const base = baseUrl.replace(/\/+$/, "");
  const ws = (id: number) => `/workspaces/${id}`;

  async function request<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError("NETWORK", 0, "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
    }
    checkVersion(res);
    if (res.status === 204) return undefined as T;
    const data = (await res.json().catch(() => null)) as ({ error?: { code: string; message: string } } & T) | null;
    if (!res.ok) {
      throw new ApiError(data?.error?.code ?? "INTERNAL", res.status, data?.error?.message ?? "Có lỗi xảy ra. Thử lại nhé.");
    }
    return data as T;
  }

  const notReal = (what: string) => new ApiError("MOCK", 0, `Đang xem dữ liệu mẫu, không ${what} thật.`);

  return {
    base,

    /** Chỉ bản web dùng: extension đổi code trong service worker. */
    async exchangeDiscordCode(code: string, redirectUri: string): Promise<string> {
      const res = await fetch(`${base}/auth/discord`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, redirectUri }),
      }).catch(() => null);
      if (!res) throw new ApiError("NETWORK", 0, "Không kết nối được máy chủ.");
      const data = (await res.json().catch(() => ({}))) as { token?: string; error?: { message?: string } };
      if (!res.ok || !data.token) throw new ApiError("DISCORD_AUTH_FAILED", res.status, data.error?.message ?? "Đăng nhập không thành công.");
      return data.token;
    },
    async me(token: string): Promise<Account> {
      if (useMock) return (await loadMock()).account;
      return request(token, "GET", "/me");
    },
    async search(token: string, q: string): Promise<SearchResult[]> {
      if (useMock) return (await loadMock()).searchResults(q);
      return (await request<{ workspaces: SearchResult[] }>(token, "GET", `/workspaces/search?q=${encodeURIComponent(q)}`)).workspaces;
    },
    async createWorkspace(token: string, name: string, isPublic: boolean): Promise<{ id: number }> {
      if (useMock) throw notReal("tạo");
      return (await request<{ workspace: { id: number } }>(token, "POST", "/workspaces", { name, isPublic })).workspace;
    },
    async join(token: string, id: number): Promise<{ status: "active" | "pending" }> {
      if (useMock) throw notReal("tham gia");
      return request(token, "POST", `${ws(id)}/join`);
    },
    async leave(token: string, id: number): Promise<void> {
      if (useMock) throw notReal("rời");
      return request(token, "POST", `${ws(id)}/leave`);
    },
    async board(token: string, id: number): Promise<Board> {
      if (useMock) return (await loadMock()).board;
      return request(token, "GET", `${ws(id)}/board`);
    },
    async recent(token: string, id: number): Promise<RecentMatch[]> {
      if (useMock) return (await loadMock()).recent;
      return (await request<{ matches: RecentMatch[] }>(token, "GET", `${ws(id)}/matches`)).matches;
    },
    async record(token: string, id: number, opponentId: number, result: "win" | "loss"): Promise<Board> {
      if (useMock) throw notReal("ghi");
      return request<Board>(token, "POST", `${ws(id)}/matches`, { opponentId, result });
    },
    async deleteMatch(token: string, id: number, matchId: number): Promise<void> {
      if (useMock) throw notReal("xóa");
      return request(token, "DELETE", `${ws(id)}/matches/${matchId}`);
    },
    async members(token: string, id: number): Promise<Member[]> {
      if (useMock) return (await loadMock()).members;
      return (await request<{ members: Member[] }>(token, "GET", `${ws(id)}/members`)).members;
    },
    async approve(token: string, id: number, userId: number): Promise<void> {
      if (useMock) throw notReal("duyệt");
      return request(token, "POST", `${ws(id)}/members/${userId}/approve`);
    },
    async removeMember(token: string, id: number, userId: number): Promise<void> {
      if (useMock) throw notReal("đuổi");
      return request(token, "DELETE", `${ws(id)}/members/${userId}`);
    },
    async updateWorkspace(token: string, id: number, patch: { name?: string; isPublic?: boolean }): Promise<void> {
      if (useMock) throw notReal("đổi");
      await request(token, "PATCH", ws(id), patch);
    },
    async logout(token: string): Promise<void> {
      if (useMock) return;
      await request(token, "POST", "/auth/logout").catch(() => undefined);
    },
  };
}
