import { useLang, type Key } from "@app/i18n.js";
import type { Tab } from "@app/types.js";

const TABS: Array<[Tab, Key]> = [
  ["board", "app.tab.board"],
  ["record", "app.tab.record"],
  ["recent", "app.tab.recent"],
  ["group", "app.tab.group"],
  ["rules", "app.tab.rules"],
];

export function TabNav({
  current,
  pendingCount,
  onPick,
}: {
  current: Tab;
  pendingCount: number;
  onPick: (tab: Tab) => void;
}) {
  const { t } = useLang();

  return (
    <nav className="tabs" role="tablist">
      {TABS.map(([tab, label]) => (
        <button
          key={tab}
          role="tab"
          aria-selected={current === tab}
          className="tab"
          onClick={() => onPick(tab)}
        >
          {t(label)}
          {tab === "group" && pendingCount > 0 && <span className="badge">{pendingCount}</span>}
        </button>
      ))}
    </nav>
  );
}
