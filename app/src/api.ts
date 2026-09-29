import type { Account, Board, MatchResult, Member, RecentMatch, SearchResult } from "./types.js";

export class ApiError extends Error {
  constructor(readonly code: string, readonly status: number, message: string) {
    super(message);
  }
}

export type Api = ReturnType<typeof createApi>;

// Written this way so the bundler sees `import.meta.env.DEV` as false and drops the mock file.
const loadMock = () =>
  import.meta.env.DEV ? import("./mock.js") : Promise.reject(new Error("Sample data exists only in a dev build"));

export interface ApiOptions {
  mock?: boolean;
  /** Fires when the server reports a different version than the first one seen, meaning a new deploy. */
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
      throw new ApiError("NETWORK", 0, "Cannot reach the server. Check your connection and try again.");
    }
    checkVersion(res);
    if (res.status === 204) return undefined as T;
    const data = (await res.json().catch(() => null)) as ({ error?: { code: string; message: string } } & T) | null;
    if (!res.ok) {
      throw new ApiError(data?.error?.code ?? "INTERNAL", res.status, data?.error?.message ?? "Something went wrong. Please try again.");
    }
    return data as T;
  }

  const notReal = (what: string) => new ApiError("MOCK", 0, `Sample data, nothing is really ${what}.`);

  return {
    base,

    async exchangeDiscordCode(code: string, redirectUri: string): Promise<string> {
      const res = await fetch(`${base}/auth/discord`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, redirectUri }),
      }).catch(() => null);
      if (!res) throw new ApiError("NETWORK", 0, "Cannot reach the server.");
      const data = (await res.json().catch(() => ({}))) as { token?: string; error?: { message?: string } };
      if (!res.ok || !data.token) throw new ApiError("DISCORD_AUTH_FAILED", res.status, data.error?.message ?? "Sign-in failed.");
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
      if (useMock) throw notReal("created");
      return (await request<{ workspace: { id: number } }>(token, "POST", "/workspaces", { name, isPublic })).workspace;
    },
    async join(token: string, id: number): Promise<{ status: "active" | "pending" }> {
      if (useMock) throw notReal("joined");
      return request(token, "POST", `${ws(id)}/join`);
    },
    async leave(token: string, id: number): Promise<void> {
      if (useMock) throw notReal("left");
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
    async record(token: string, id: number, opponentId: number, result: MatchResult): Promise<Board> {
      if (useMock) throw notReal("recorded");
      return request<Board>(token, "POST", `${ws(id)}/matches`, { opponentId, result });
    },
    async deleteMatch(token: string, id: number, matchId: number): Promise<void> {
      if (useMock) throw notReal("deleted");
      return request(token, "DELETE", `${ws(id)}/matches/${matchId}`);
    },
    async members(token: string, id: number): Promise<Member[]> {
      if (useMock) return (await loadMock()).members;
      return (await request<{ members: Member[] }>(token, "GET", `${ws(id)}/members`)).members;
    },
    async approve(token: string, id: number, userId: number): Promise<void> {
      if (useMock) throw notReal("approved");
      return request(token, "POST", `${ws(id)}/members/${userId}/approve`);
    },
    async removeMember(token: string, id: number, userId: number): Promise<void> {
      if (useMock) throw notReal("removed");
      return request(token, "DELETE", `${ws(id)}/members/${userId}`);
    },
    async updateWorkspace(token: string, id: number, patch: { name?: string; isPublic?: boolean }): Promise<void> {
      if (useMock) throw notReal("changed");
      await request(token, "PATCH", ws(id), patch);
    },
    async logout(token: string): Promise<void> {
      if (useMock) return;
      await request(token, "POST", "/auth/logout").catch(() => undefined);
    },
  };
}
