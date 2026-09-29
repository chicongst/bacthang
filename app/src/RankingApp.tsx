import { useEffect, useState } from "react";
import { PlatformContext } from "./context.js";
import { fmtDelta } from "./format.js";
import { useSession } from "./hooks/useSession.js";
import { useWorkspace } from "./hooks/useWorkspace.js";
import { LangProvider, useLang, type Key } from "./i18n.js";
import { LangToggle } from "./components/LangToggle.js";
import type { Platform } from "./platform.js";
import { Board } from "./views/Board.js";
import { Group } from "./views/Group.js";
import { Login } from "./views/Login.js";
import { MeCard } from "./views/MeCard.js";
import { Recent } from "./views/Recent.js";
import { Record } from "./views/Record.js";
import { Rules } from "./views/Rules.js";
import { WorkspaceSwitcher } from "./views/WorkspaceSwitcher.js";
import { Workspaces } from "./views/Workspaces.js";

type Tab = "board" | "record" | "recent" | "group" | "rules";

const TABS: Array<[Tab, Key]> = [
  ["board", "app.tab.board"],
  ["record", "app.tab.record"],
  ["recent", "app.tab.recent"],
  ["group", "app.tab.group"],
  ["rules", "app.tab.rules"],
];

const TOAST_MS = 2600;

export function RankingApp({ platform }: { platform: Platform }) {
  return (
    <PlatformContext.Provider value={platform}>
      <LangProvider>
        <Shell platform={platform} />
      </LangProvider>
    </PlatformContext.Provider>
  );
}

function Shell({ platform }: { platform: Platform }) {
  const { api, boardName, isMock } = platform;
  const { t } = useLang();

  // Xem trước giao diện bằng URL (?mock&tab=group, ?mock&view=login), chỉ có ở chế độ dữ liệu mẫu.
  const preview = isMock ? new URLSearchParams(location.search) : null;

  const [tab, setTab] = useState<Tab>((preview?.get("tab") as Tab | null) ?? "board");
  const [picking, setPicking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  const { token, signOut, forget } = useSession(platform);
  const workspace = useWorkspace(platform, token, forget, tab);
  const { account, workspaceId, board, recent, live, membersVersion, error } = workspace;

  useEffect(() => platform.onServerChanged(() => setStale(true)), [platform]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  async function openWorkspace(id: number | null) {
    setPicking(false);
    setTab("board");
    await workspace.choose(id);
  }

  if (preview?.get("view") === "login") return <Login />;
  if (token === undefined) return <div className="boot" />;
  if (token === null) return <Login />;
  if (workspaceId === undefined) return <div className="boot" />;

  if (workspaceId === null || picking || preview?.get("view") === "workspaces") {
    return (
      <Workspaces
        token={token}
        canCancel={workspaceId !== null}
        onDone={openWorkspace}
        onCancel={() => setPicking(false)}
      />
    );
  }

  return (
    <div className="shell">
      <header className="top">
        <WorkspaceSwitcher
          workspaces={account?.workspaces ?? []}
          currentId={workspaceId}
          currentName={board?.workspace.name ?? boardName}
          live={live}
          onPick={openWorkspace}
          onBrowse={() => setPicking(true)}
        />
        {isMock && !preview?.has("clean") && <span className="mock-tag">{t("app.mock")}</span>}
        <LangToggle />
        <button className="icon-btn" onClick={signOut} aria-label={t("app.logout")} title={t("app.logout")}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />
          </svg>
        </button>
      </header>

      {board ? (
        <MeCard me={board.me} total={board.workspace.memberCount} />
      ) : (
        <section className="me me-skeleton">{error ?? t("app.loading")}</section>
      )}

      <nav className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className="tab" onClick={() => setTab(id)}>
            {t(label)}
            {id === "group" && !!board?.me.pendingCount && <span className="badge">{board.me.pendingCount}</span>}
          </button>
        ))}
      </nav>

      <div className="panel" role="tabpanel">
        {!board ? (
          error && (
            <div className="empty">
              <p>{error}</p>
              <button className="ghost" onClick={workspace.reloadBoard}>
                {t("app.retry")}
              </button>
            </div>
          )
        ) : tab === "board" ? (
          <Board players={board.players} meId={board.me.id} />
        ) : tab === "record" ? (
          <Record
            me={board.me}
            players={board.players}
            onSubmit={async (opponentId, result) => {
              try {
                const updated = await api.record(token, workspaceId, opponentId, result);
                workspace.applyBoard(updated);
                const delta = result === "win" ? updated.me.winPoints : updated.me.lossPoints;
                setToast(t("app.toast.recorded", { delta: fmtDelta(delta) }));
                return null;
              } catch (err) {
                return workspace.describeError(err);
              }
            }}
          />
        ) : tab === "recent" ? (
          <Recent
            matches={recent}
            canDelete={board.me.role === "owner" || !!account?.isServerAdmin}
            onDelete={async (matchId) => {
              try {
                await api.deleteMatch(token, workspaceId, matchId);
                workspace.dropMatch(matchId);
                await workspace.reloadBoard();
                setToast(t("app.toast.deleted"));
                return null;
              } catch (err) {
                return workspace.describeError(err);
              }
            }}
          />
        ) : tab === "rules" ? (
          <Rules rules={board.rules} me={board.me} />
        ) : (
          <Group
            token={token}
            board={board}
            refreshKey={membersVersion}
            onChanged={workspace.reloadBoard}
            onLeft={() => openWorkspace(null)}
          />
        )}
      </div>

      {stale && (
        <div className="stale" role="alert">
          <span>{t("app.stale")}</span>
          <button onClick={() => location.reload()}>{t("app.staleReload")}</button>
        </div>
      )}

      {toast && !stale && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
