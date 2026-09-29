import "@fontsource/be-vietnam-pro/400";
import "@fontsource/be-vietnam-pro/500";
import "@fontsource/be-vietnam-pro/600";
import "@fontsource/be-vietnam-pro/700";
import "@fontsource/be-vietnam-pro/800";
import "@fontsource/big-shoulders-display/700";
import "@fontsource/big-shoulders-display/800";
import "@app/styles.css";
import "./web.css";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { RankingApp } from "@app/RankingApp.js";
import { consumeDiscordRedirect, createWebPlatform } from "./platform.js";

function Root() {
  const [loginError, setLoginError] = useState<string | null>(null);
  const [platform] = useState(() => createWebPlatform(setLoginError));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    consumeDiscordRedirect().then((r) => {
      if (r.error) setLoginError(r.error);
      setReady(true);
    });
  }, []);

  if (!ready) return <div className="boot" />;

  return (
    <div className="page">
      {loginError && (
        <div className="page-error" role="alert">
          {loginError}
          <button onClick={() => setLoginError(null)} aria-label="Đóng">×</button>
        </div>
      )}
      <div className="frame">
        <RankingApp platform={platform} />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
