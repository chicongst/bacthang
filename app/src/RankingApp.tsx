import { useState } from "react";
import { PlatformContext } from "./context.js";
import { useSession } from "./hooks/useSession.js";
import { useWorkspace } from "./hooks/useWorkspace.js";
import { LangProvider } from "./i18n.js";
import type { Platform } from "./platform.js";
import type { Tab } from "./types.js";
import { Login } from "./views/Login.js";
import { Shell } from "./views/Shell/index.js";
import { Workspaces } from "./views/Workspaces/index.js";

export function RankingApp({ platform }: { platform: Platform }) {
  return (
    <PlatformContext.Provider value={platform}>
      <LangProvider>
        <AppRoot platform={platform} />
      </LangProvider>
    </PlatformContext.Provider>
  );
}

function AppRoot({ platform }: { platform: Platform }) {
  // URL-driven preview (?mock&tab=group, ?mock&view=login), sample-data mode only.
  const preview = platform.isMock ? new URLSearchParams(location.search) : null;

  const [tab, setTab] = useState<Tab>((preview?.get("tab") as Tab | null) ?? "board");
  const [picking, setPicking] = useState(false);
  const { token, signOut, forget } = useSession(platform);
  const workspace = useWorkspace(platform, token, forget, tab);
  const { workspaceId } = workspace;

  async function openWorkspace(id: number | null) {
    setPicking(false);
    setTab("board");
    await workspace.choose(id);
  }

  if (preview?.get("view") === "login") return <Login />;
  if (token === undefined) return <div className="boot" />;
  if (token === null) return <Login />;
  if (workspaceId === undefined) return <div className="boot" />;

  if (workspaceId === null || picking || preview?.get("view") === "workspaces") {
    return (
      <Workspaces
        token={token}
        canCancel={workspaceId !== null}
        onDone={openWorkspace}
        onCancel={() => setPicking(false)}
      />
    );
  }

  return (
    <Shell
      token={token}
      workspaceId={workspaceId}
      workspace={workspace}
      tab={tab}
      showMockTag={platform.isMock && !preview?.has("clean")}
      onTab={setTab}
      onBrowse={() => setPicking(true)}
      onOpenWorkspace={openWorkspace}
      onSignOut={signOut}
    />
  );
}
