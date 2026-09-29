import type { SearchResult } from "@app/types.js";
import { useLang } from "@app/i18n.js";

export function WorkspaceResults({
  results,
  joiningId,
  onOpen,
  onJoin,
}: {
  results: SearchResult[] | null;
  joiningId: number | null;
  onOpen: (workspaceId: number) => void;
  onJoin: (workspace: SearchResult) => void;
}) {
  const { t } = useLang();

  return (
    <ul className="ws-list">
      {results === null && <li className="empty small">{t("ws.searching")}</li>}
      {results?.length === 0 && <li className="empty small">{t("ws.noResult")}</li>}
      {results?.map((workspace) => (
        <li key={workspace.id} className="ws-row">
          <span className="ws-id">
            <span className="ws-name">
              {workspace.name}
              {!workspace.isPublic && (
                <svg className="lock" viewBox="0 0 24 24" aria-label={t("ws.privateAria")}>
                  <path d="M6 11h12v9H6zM9 11V7a3 3 0 0 1 6 0v4" />
                </svg>
              )}
            </span>
            <span className="ws-meta">{t("ws.memberCount", { n: workspace.memberCount })}</span>
          </span>
          <JoinControl
            workspace={workspace}
            joining={joiningId === workspace.id}
            onOpen={() => onOpen(workspace.id)}
            onJoin={() => onJoin(workspace)}
          />
        </li>
      ))}
    </ul>
  );
}

function JoinControl({
  workspace,
  joining,
  onOpen,
  onJoin,
}: {
  workspace: SearchResult;
  joining: boolean;
  onOpen: () => void;
  onJoin: () => void;
}) {
  const { t } = useLang();

  if (workspace.myStatus === "active") {
    return (
      <button className="ws-go" onClick={onOpen}>
        {t("ws.go")}
      </button>
    );
  }
  if (workspace.myStatus === "pending") {
    return <span className="ws-pending">{t("ws.pending")}</span>;
  }

  return (
    <button className="ws-join" disabled={joining} onClick={onJoin}>
      {joining ? t("ws.joining") : t(workspace.isPublic ? "ws.join" : "ws.request")}
    </button>
  );
}
