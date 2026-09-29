import { useEffect, useRef, useState } from "react";
import { useLang } from "@app/i18n.js";
import type { Season } from "@app/types.js";

export function SeasonSwitcher({
  seasons,
  current,
  viewing,
  onPick,
}: {
  seasons: Season[];
  current: number;
  viewing: number | null;
  onPick: (seasonId: number | null) => void;
}) {
  const { t, locale } = useLang();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const closed = seasons.filter((season) => season.endedAt);
  if (closed.length === 0) return null;

  const day = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso));

  const viewed = closed.find((season) => season.id === viewing);
  const label = viewed ? t("season.past", { n: viewed.number }) : t("season.current", { n: current });

  return (
    <div className="season-picker" ref={root}>
      <button
        className="season-btn"
        aria-expanded={open}
        aria-label={t("season.aria")}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <svg className="season-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 3v4M18 3v4M3.5 9.5h17M5 6h14a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5v-11A1.5 1.5 0 0 1 5 6Z" />
        </svg>
        <span className="season-name">{label}</span>
        <svg className="caret" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="menu season-menu" role="menu">
          <button
            role="menuitem"
            className={`menu-row ${viewing === null ? "on" : ""}`}
            onClick={() => {
              setOpen(false);
              onPick(null);
            }}
          >
            <span className="menu-name">{t("season.current", { n: current })}</span>
            <span className="season-live">{t("season.playing")}</span>
          </button>
          {closed.map((season) => (
            <button
              key={season.id}
              role="menuitem"
              className={`menu-row ${viewing === season.id ? "on" : ""}`}
              onClick={() => {
                setOpen(false);
                onPick(season.id);
              }}
            >
              <span className="menu-name">{t("season.past", { n: season.number })}</span>
              {season.endedAt && <span className="season-when">{day(season.endedAt)}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
