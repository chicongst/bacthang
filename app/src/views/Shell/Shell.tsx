import { useEffect, useState } from "react";
import { usePlatform } from "@app/context.js";
import { fmtDelta } from "@app/format.js";
import type { WorkspaceState } from "@app/hooks/useWorkspace.js";
import { useLang } from "@app/i18n.js";
import type { MatchResult, Tab } from "@app/types.js";
import { MeCard } from "@app/views/MeCard.js";
import { AppHeader } from "./elements/AppHeader.js";
import { TabNav } from "./elements/TabNav.js";
import { TabPanel } from "./elements/TabPanel.js";
import { TournamentBanner } from "./elements/TournamentBanner.js";

const TOAST_MS = 2600;

export function Shell({
  token,
  workspaceId,
  workspace,
  tab,
  showMockTag,
  onTab,
  onBrowse,
  onOpenWorkspace,
  onSignOut,
}: {
  token: string;
  workspaceId: number;
  workspace: WorkspaceState;
  tab: Tab;
  showMockTag: boolean;
  onTab: (tab: Tab) => void;
  onBrowse: () => void;
  onOpenWorkspace: (workspaceId: number | null) => void;
  onSignOut: () => void;
}) {
  const { api, boardName, onServerChanged } = usePlatform();
  const { t } = useLang();
  const { account, board, recent, live, membersVersion, error } = workspace;
  const [toast, setToast] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => onServerChanged(() => setStale(true)), [onServerChanged]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  async function recordMatch(opponentId: number, result: MatchResult): Promise<string | null> {
    try {
      const updated = await api.record(token, workspaceId, opponentId, result);
      workspace.applyBoard(updated);
      const delta = result === "win" ? updated.me.winPoints : updated.me.lossPoints;
      setToast(t("app.toast.recorded", { delta: fmtDelta(delta) }));
      return null;
    } catch (err) {
      return workspace.describeError(err);
    }
  }

  async function deleteMatch(matchId: number): Promise<string | null> {
    try {
      await api.deleteMatch(token, workspaceId, matchId);
      workspace.dropMatch(matchId);
      await workspace.reloadBoard();
      setToast(t("app.toast.deleted"));
      return null;
    } catch (err) {
      return workspace.describeError(err);
    }
  }

  return (
    <div className="shell">
      <AppHeader
        workspaces={account?.workspaces ?? []}
        currentId={workspaceId}
        currentName={board?.workspace.name ?? boardName}
        live={live}
        showMockTag={showMockTag}
        onPick={onOpenWorkspace}
        onBrowse={onBrowse}
        onSignOut={onSignOut}
      />

      <TournamentBanner name={board?.workspace.tournamentName ?? null} />

      {board ? (
        <MeCard me={board.me} total={board.workspace.memberCount} />
      ) : (
        <section className="me me-skeleton">{error ?? t("app.loading")}</section>
      )}

      <TabNav current={tab} pendingCount={board?.me.pendingCount ?? 0} onPick={onTab} />

      <div className="panel" role="tabpanel">
        {board ? (
          <TabPanel
            tab={tab}
            token={token}
            board={board}
            recent={recent}
            canDeleteMatches={board.me.role === "owner" || !!account?.isServerAdmin}
            membersVersion={membersVersion}
            onRecord={recordMatch}
            onDeleteMatch={deleteMatch}
            onMembersChanged={workspace.reloadBoard}
            onLeft={() => onOpenWorkspace(null)}
          />
        ) : (
          error && (
            <div className="empty">
              <p>{error}</p>
              <button className="ghost" onClick={workspace.reloadBoard}>
                {t("app.retry")}
              </button>
            </div>
          )
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
