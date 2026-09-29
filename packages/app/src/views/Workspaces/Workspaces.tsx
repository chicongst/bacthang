import { useEffect, useState } from "react";
import { ApiError } from "@app/api.js";
import { usePlatform } from "@app/context.js";
import { useLang } from "@app/i18n.js";
import type { SearchResult } from "@app/types.js";
import { CreateWorkspaceForm } from "./elements/CreateWorkspaceForm.js";
import { PickerHeader } from "./elements/PickerHeader.js";
import { WorkspaceResults } from "./elements/WorkspaceResults.js";

const SEARCH_DEBOUNCE_MS = 250;

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
  const [draft, setDraft] = useState({ name: "", isPublic: true });
  const [busy, setBusy] = useState<number | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(
      () => {
        api.search(token, query).then(
          (found) => alive && setResults(found),
          (e: unknown) => alive && setError(e instanceof Error ? e.message : t("ws.searchFailed")),
        );
      },
      query ? SEARCH_DEBOUNCE_MS : 0,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [token, query]);

  async function join(workspace: SearchResult) {
    setBusy(workspace.id);
    setError(null);
    setNote(null);
    try {
      const joined = await api.join(token, workspace.id);
      if (joined.status === "active") {
        onDone(workspace.id);
        return;
      }
      setNote(t("ws.requested", { name: workspace.name }));
      setResults(
        (current) =>
          current?.map((row) => (row.id === workspace.id ? { ...row, myStatus: "pending" } : row)) ?? null,
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("ws.joinFailed"));
    }
    setBusy(null);
  }

  async function create() {
    setBusy("new");
    setError(null);
    try {
      const workspace = await api.createWorkspace(token, draft.name, draft.isPublic);
      onDone(workspace.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("ws.createFailed"));
      setBusy(null);
    }
  }

  function showList() {
    setCreating(false);
    setError(null);
  }

  return (
    <div className="picker-screen">
      <PickerHeader
        title={creating ? t("ws.createTitle") : t("ws.enter")}
        canCancel={canCancel}
        onCancel={onCancel}
      />

      {creating ? (
        <CreateWorkspaceForm
          name={draft.name}
          isPublic={draft.isPublic}
          busy={busy === "new"}
          error={error}
          onNameChange={(name) => setDraft((current) => ({ ...current, name }))}
          onModeChange={(isPublic) => setDraft((current) => ({ ...current, isPublic }))}
          onCreate={create}
          onBack={showList}
        />
      ) : (
        <>
          <input
            className="search"
            placeholder={t("ws.search")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
            autoFocus
          />
          {note && (
            <p className="note-ok" role="status">
              {note}
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <WorkspaceResults
            results={results}
            joiningId={typeof busy === "number" ? busy : null}
            onOpen={onDone}
            onJoin={join}
          />
          <button
            className="submit"
            onClick={() => {
              setCreating(true);
              setError(null);
            }}
          >
            {t("ws.createTitle")}
          </button>
        </>
      )}
    </div>
  );
}
