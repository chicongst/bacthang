import { useEffect, useState } from "react";
import type { SearchResult } from "../types.js";
import { ApiError } from "../api.js";
import { usePlatform } from "../context.js";
import { useLang } from "../i18n.js";
import { LangToggle } from "../components/LangToggle.js";

export function Workspaces({
  token,
  canCancel,
  onDone,
  onCancel,
}: {
  token: string;
  canCancel: boolean;
  onDone: (workspaceId: number | null) => void;
  onCancel: () => void;
}) {
  const { api } = usePlatform();
  const { t } = useLang();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState<number | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const id = setTimeout(() => {
      api.search(token, query).then(
        (r) => alive && setResults(r),
        (e: unknown) => alive && setError(e instanceof Error ? e.message : t("ws.searchFailed")),
      );
    }, query ? 250 : 0);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [token, query]);

  async function join(w: SearchResult) {
    setBusy(w.id);
    setError(null);
    setNote(null);
    try {
      const r = await api.join(token, w.id);
      if (r.status === "active") onDone(w.id);
      else {
        setNote(t("ws.requested", { name: w.name }));
        setResults((rs) => rs?.map((x) => (x.id === w.id ? { ...x, myStatus: "pending" } : x)) ?? null);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("ws.joinFailed"));
    }
    setBusy(null);
  }

  async function create() {
    setBusy("new");
    setError(null);
    try {
      const w = await api.createWorkspace(token, name, isPublic);
      onDone(w.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("ws.createFailed"));
      setBusy(null);
    }
  }

  return (
    <div className="picker-screen">
      <header className="picker-top">
        <div>
          <p className="eyebrow">{t("ws.eyebrow")}</p>
          <h1>{creating ? t("ws.createTitle") : t("ws.enter")}</h1>
        </div>
        <span className="picker-actions">
          <LangToggle />
          {canCancel && (
            <button className="icon-btn" onClick={onCancel} aria-label={t("ws.backAria")}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </span>
      </header>

      {creating ? (
        <div className="create">
          <label className="field-label" htmlFor="ws-name">{t("ws.name")}</label>
          <input
            id="ws-name"
            className="search"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("ws.namePlaceholder")}
            maxLength={40}
            autoFocus
          />
          <div className="modes" role="radiogroup" aria-label={t("ws.modeAria")}>
            <button type="button" role="radio" aria-checked={isPublic} className="mode" onClick={() => setIsPublic(true)}>
              <b>{t("ws.public")}</b>
              <span>{t("ws.publicHint")}</span>
            </button>
            <button type="button" role="radio" aria-checked={!isPublic} className="mode" onClick={() => setIsPublic(false)}>
              <b>{t("ws.private")}</b>
              <span>{t("ws.privateHint")}</span>
            </button>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="submit" disabled={name.trim().length < 2 || busy === "new"} onClick={create}>
            {busy === "new" ? t("ws.creating") : t("ws.create")}
          </button>
          <button className="ghost" onClick={() => { setCreating(false); setError(null); }}>
            {t("ws.back")}
          </button>
        </div>
      ) : (
        <>
          <input
            className="search"
            placeholder={t("ws.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            autoFocus
          />
          {note && <p className="note-ok" role="status">{note}</p>}
          {error && <p className="error" role="alert">{error}</p>}
          <ul className="ws-list">
            {results === null && <li className="empty small">{t("ws.searching")}</li>}
            {results?.length === 0 && <li className="empty small">{t("ws.noResult")}</li>}
            {results?.map((w) => (
              <li key={w.id} className="ws-row">
                <span className="ws-id">
                  <span className="ws-name">
                    {w.name}
                    {!w.isPublic && (
                      <svg className="lock" viewBox="0 0 24 24" aria-label={t("ws.privateAria")}>
                        <path d="M6 11h12v9H6zM9 11V7a3 3 0 0 1 6 0v4" />
                      </svg>
                    )}
                  </span>
                  <span className="ws-meta">{t("ws.memberCount", { n: w.memberCount })}</span>
                </span>
                {w.myStatus === "active" ? (
                  <button className="ws-go" onClick={() => onDone(w.id)}>{t("ws.go")}</button>
                ) : w.myStatus === "pending" ? (
                  <span className="ws-pending">{t("ws.pending")}</span>
                ) : (
                  <button className="ws-join" disabled={busy === w.id} onClick={() => join(w)}>
                    {busy === w.id ? "…" : w.isPublic ? t("ws.join") : t("ws.request")}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button className="submit" onClick={() => { setCreating(true); setError(null); }}>
            {t("ws.createTitle")}
          </button>
        </>
      )}
    </div>
  );
}
