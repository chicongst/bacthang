import { useLang } from "../i18n.js";

/** Cờ Việt Nam và cờ Anh vẽ bằng SVG — emoji cờ không hiện được trên Windows. */
function FlagVN() {
  return (
    <svg viewBox="0 0 30 20" className="flag" aria-hidden="true">
      <rect width="30" height="20" rx="2.5" fill="#DA251D" />
      <path fill="#FF0" d="M15 4.4l1.76 5.42h5.7l-4.61 3.35 1.76 5.42L15 15.24l-4.61 3.35 1.76-5.42-4.61-3.35h5.7z" />
    </svg>
  );
}

function FlagUK() {
  return (
    <svg viewBox="0 0 30 20" className="flag" aria-hidden="true">
      <rect width="30" height="20" rx="2.5" fill="#012169" />
      <path d="M0 0l30 20M30 0L0 20" stroke="#fff" strokeWidth="4" />
      <path d="M0 0l30 20M30 0L0 20" stroke="#C8102E" strokeWidth="2" />
      <path d="M15 0v20M0 10h30" stroke="#fff" strokeWidth="6.5" />
      <path d="M15 0v20M0 10h30" stroke="#C8102E" strokeWidth="3.5" />
    </svg>
  );
}

export function LangToggle() {
  const { lang, setLang, t } = useLang();
  const next = lang === "vi" ? "en" : "vi";
  return (
    <button className="lang-toggle" onClick={() => setLang(next)} aria-label={t("app.lang.switch")} title={t("app.lang.switch")}>
      {next === "en" ? <FlagUK /> : <FlagVN />}
      <span>{next === "en" ? "EN" : "VI"}</span>
    </button>
  );
}
