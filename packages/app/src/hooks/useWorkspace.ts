import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@app/api.js";
import { subscribeWorkspace } from "@app/events.js";
import { useLang } from "@app/i18n.js";
import type { Platform } from "@app/platform.js";
import type { Account, Board, RecentMatch, Season, SeasonTable } from "@app/types.js";

export interface WorkspaceState {
  account: Account | null;
  workspaceId: number | null | undefined;
  board: Board | null;
  recent: RecentMatch[] | null;
  live: boolean;
  membersVersion: number;
  seasons: Season[] | null;
  /** The season being read from the archive. null means the board being played. */
  archive: SeasonTable | null;
  error: string | null;
  describeError: (err: unknown) => Promise<string>;
  reloadBoard: () => Promise<void>;
  applyBoard: (board: Board) => void;
  dropMatch: (matchId: number) => void;
  choose: (workspaceId: number | null) => Promise<void>;
  viewSeason: (seasonId: number | null) => Promise<void>;
}

export function useWorkspace(
  platform: Platform,
  token: string | null | undefined,
  forgetToken: () => Promise<void>,
  activeTab: string,
): WorkspaceState {
  const { api, isMock } = platform;
  const { t, tError } = useLang();

  const [account, setAccount] = useState<Account | null>(null);
  const [workspaceId, setWorkspaceId] = useState<number | null | undefined>(undefined);
  const [board, setBoard] = useState<Board | null>(null);
  const [recent, setRecent] = useState<RecentMatch[] | null>(null);
  const [live, setLive] = useState(false);
  const [membersVersion, setMembersVersion] = useState(0);
  const [seasons, setSeasons] = useState<Season[] | null>(null);
  const [archive, setArchive] = useState<SeasonTable | null>(null);
  const [error, setError] = useState<string | null>(null);

  // These refs keep describeError and the event stream stable across board updates;
  // depending on state directly would tear the SSE connection down on every change.
  const boardRef = useRef<Board | null>(null);
  const tabRef = useRef(activeTab);
  boardRef.current = board;
  tabRef.current = activeTab;

  const describeError = useCallback(
    async (err: unknown): Promise<string> => {
      if (err instanceof ApiError && err.status === 401) await forgetToken();
      if (err instanceof ApiError && (err.code === "NOT_MEMBER" || err.code === "PENDING_APPROVAL")) {
        await platform.setActiveWorkspace(null);
        setBoard(null);
        setWorkspaceId(null);
      }
      if (err instanceof ApiError) {
        return tError(err.code, err.message, { limit: boardRef.current?.me.dailyLimitPerPair ?? "" });
      }
      return err instanceof Error ? err.message : t("app.error.generic");
    },
    [platform, forgetToken, t, tError],
  );

  const loadAccount = useCallback(
    async (activeToken: string) => {
      try {
        const loaded = await api.me(activeToken);
        setAccount(loaded);
        const joined = loaded.workspaces.filter((row) => row.status === "active");
        const saved = await platform.getActiveWorkspace();
        const next = joined.find((row) => row.id === saved)?.id ?? joined[0]?.id ?? null;
        setWorkspaceId(next);
        if (next !== saved) await platform.setActiveWorkspace(next);
        setError(null);
      } catch (err) {
        setError(await describeError(err));
        setWorkspaceId(null);
      }
    },
    [api, platform, describeError],
  );

  const loadBoard = useCallback(
    async (activeToken: string, id: number) => {
      try {
        setBoard(await api.board(activeToken, id));
        setError(null);
      } catch (err) {
        setBoard(null);
        setError(await describeError(err));
      }
    },
    [api, describeError],
  );

  /** Keeps the old list while reloading, otherwise the screen flickers on every event. */
  const loadRecent = useCallback(
    async (activeToken: string, id: number) => {
      try {
        setRecent(await api.recent(activeToken, id));
      } catch {
        setRecent((prev) => prev ?? []);
      }
    },
    [api],
  );

  useEffect(() => {
    if (token) loadAccount(token);
    else {
      setAccount(null);
      setBoard(null);
      setWorkspaceId(undefined);
    }
  }, [token, loadAccount]);

  useEffect(() => {
    if (token && workspaceId) loadBoard(token, workspaceId);
  }, [token, workspaceId, loadBoard]);

  // Only worth a request once a season has actually been closed.
  useEffect(() => {
    if (!token || !workspaceId || !board?.workspace.pastSeasons) return;
    api.seasons(token, workspaceId).then(setSeasons, () => setSeasons(null));
  }, [token, workspaceId, api, board?.workspace.pastSeasons]);

  useEffect(() => {
    setArchive(null);
    setSeasons(null);
  }, [workspaceId]);

  useEffect(() => {
    if (token && workspaceId && activeTab === "recent") loadRecent(token, workspaceId);
  }, [token, workspaceId, activeTab, loadRecent]);

  useEffect(() => {
    if (!token || !workspaceId || isMock) return;
    setLive(false);
    return subscribeWorkspace({
      base: api.base,
      token,
      workspaceId,
      onConnected: setLive,
      onEvent: (scope) => {
        loadBoard(token, workspaceId);
        if (tabRef.current === "recent") loadRecent(token, workspaceId);
        if (scope === "members") setMembersVersion((version) => version + 1);
      },
    });
  }, [token, workspaceId, api, isMock, loadBoard, loadRecent]);

  const choose = useCallback(
    async (id: number | null) => {
      const same = id !== null && id === workspaceId;
      // Re-picking the workspace already open keeps the data: workspaceId does not change,
      // so the loading effect never runs and clearing here would hang on the loading screen.
      if (!same) {
        setBoard(null);
        setRecent(null);
      }
      await platform.setActiveWorkspace(id);
      setWorkspaceId(id);
      if (token) {
        if (same && id !== null) await loadBoard(token, id);
        await loadAccount(token);
      }
    },
    [workspaceId, platform, token, loadBoard, loadAccount],
  );

  return {
    account,
    workspaceId,
    board,
    recent,
    live,
    membersVersion,
    error,
    describeError,
    reloadBoard: useCallback(
      async () => (token && workspaceId ? loadBoard(token, workspaceId) : undefined),
      [token, workspaceId, loadBoard],
    ),
    seasons,
    archive,
    viewSeason: useCallback(
      async (seasonId: number | null) => {
        if (!token || !workspaceId || seasonId === null) {
          setArchive(null);
          return;
        }
        try {
          setArchive(await api.seasonTable(token, workspaceId, seasonId));
        } catch (err) {
          setError(await describeError(err));
        }
      },
      [api, token, workspaceId, describeError],
    ),
    applyBoard: setBoard,
    dropMatch: useCallback((matchId: number) => setRecent((current) => current?.filter((match) => match.id !== matchId) ?? null), []),
    choose,
  };
}
