import { useEffect, useRef, useState } from "react";
import { useLang } from "../i18n.js";
import { TierBadge } from "../components/TierBadge.js";
import type { WorkspaceSummary } from "../types.js";

export function WorkspaceSwitcher({
  workspaces,
  currentId,
  currentName,
  live,
  onPick,
  onBrowse,
}: {
  workspaces: WorkspaceSummary[];
  currentId: number | null | undefined;
  currentName: string;
  live: boolean;
  onPick: (workspaceId: number) => void;
  onBrowse: () => void;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const joined = workspaces.filter((w) => w.status === "active");
  const waiting = workspaces.filter((w) => w.status === "pending");

  return (
    <div className="switcher" ref={root}>
      <button className="ws-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span
          className={`brand-mark ${live ? "is-live" : ""}`}
          aria-hidden="true"
          title={live ? t("app.live.on") : t("app.live.off")}
        />
        <span className="ws-btn-name">{currentName}</span>
        <svg className="caret" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="menu" role="menu">
          {joined.map((w) => (
            <button
              key={w.id}
              role="menuitem"
              className={`menu-row ${w.id === currentId ? "on" : ""}`}
              onClick={() => {
                setOpen(false);
                onPick(w.id);
              }}
            >
              <TierBadge tier={w.tier.id} size={18} title={w.name} />
              <span className="menu-name">{w.name}</span>
              <span className="num menu-points">{w.points}</span>
            </button>
          ))}
          {waiting.map((w) => (
            <span key={w.id} className="menu-row muted-row">
              <span className="menu-name">{w.name}</span>
              <span className="ws-pending">{t("app.switch.pending")}</span>
            </span>
          ))}
          <button
            role="menuitem"
            className="menu-row add"
            onClick={() => {
              setOpen(false);
              onBrowse();
            }}
          >
            {t("app.switch.find")}
          </button>
        </div>
      )}
    </div>
  );
}
