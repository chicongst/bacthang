import { LangToggle } from "@app/components/LangToggle.js";
import { useLang } from "@app/i18n.js";
import type { WorkspaceSummary } from "@app/types.js";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher.js";

export function AppHeader({
  workspaces,
  currentId,
  currentName,
  live,
  showMockTag,
  onPick,
  onBrowse,
  onSignOut,
}: {
  workspaces: WorkspaceSummary[];
  currentId: number;
  currentName: string;
  live: boolean;
  showMockTag: boolean;
  onPick: (workspaceId: number) => void;
  onBrowse: () => void;
  onSignOut: () => void;
}) {
  const { t } = useLang();

  return (
    <header className="top">
      <WorkspaceSwitcher
        workspaces={workspaces}
        currentId={currentId}
        currentName={currentName}
        live={live}
        onPick={onPick}
        onBrowse={onBrowse}
      />
      {showMockTag && <span className="mock-tag">{t("app.mock")}</span>}
      <LangToggle />
      <button className="icon-btn" onClick={onSignOut} aria-label={t("app.logout")} title={t("app.logout")}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />
        </svg>
      </button>
    </header>
  );
}
