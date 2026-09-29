import { useState } from "react";
import { usePlatform } from "../context.js";
import { useLang } from "../i18n.js";
import { LangToggle } from "../components/LangToggle.js";
import { TierBadge } from "../components/TierBadge.js";

export function Login() {
  const { boardName, kind, startLogin } = usePlatform();
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const r = await startLogin().catch((e: unknown) => ({ ok: false as const, message: String(e) }));
    if (!r.ok) setError(r.message);
    setBusy(false);
  }

  return (
    <main className="login">
      <div className="login-lang"><LangToggle /></div>
      <div className="login-badges" aria-hidden="true">
        <TierBadge tier="gold" size={46} />
        <TierBadge tier="master" size={72} />
        <TierBadge tier="diamond" size={46} />
      </div>
      <div className="login-copy">
        <p className="eyebrow">{boardName}</p>
        <h1>{t("login.title")}</h1>
      </div>
      <button className="discord" onClick={go} disabled={busy}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M19.6 5.3A17.6 17.6 0 0 0 15.3 4l-.2.4a16.3 16.3 0 0 1 3.9 1.9 13.6 13.6 0 0 0-11.9 0A16.3 16.3 0 0 1 11 4.4l-.3-.4a17.6 17.6 0 0 0-4.3 1.3C3.7 9.4 3 13.4 3.3 17.3a17.7 17.7 0 0 0 5.4 2.7l1.1-1.6a11.6 11.6 0 0 1-1.8-.9l.4-.3a12.6 12.6 0 0 0 11.2 0l.4.3c-.6.4-1.2.7-1.8.9l1.1 1.6a17.6 17.6 0 0 0 5.4-2.7c.4-4.6-.7-8.5-3.1-12ZM9.3 14.9c-1 0-1.9-1-1.9-2.2s.8-2.2 1.9-2.2 1.9 1 1.9 2.2-.8 2.2-1.9 2.2Zm5.4 0c-1 0-1.9-1-1.9-2.2s.8-2.2 1.9-2.2 1.9 1 1.9 2.2-.8 2.2-1.9 2.2Z"
          />
        </svg>
        {busy ? t("login.opening") : t("login.button")}
      </button>
      {error ? (
        <p className="error" role="alert">{error}</p>
      ) : (
        <p className="fine">{t(kind === "web" ? "login.hint.web" : "login.hint.extension")}</p>
      )}
    </main>
  );
}
