import "@fontsource/be-vietnam-pro/400";
import "@fontsource/be-vietnam-pro/500";
import "@fontsource/be-vietnam-pro/600";
import "@fontsource/be-vietnam-pro/700";
import "@fontsource/be-vietnam-pro/800";
import "@fontsource/big-shoulders-display/700";
import "@fontsource/big-shoulders-display/800";
import "@app/styles.css";
import "./popup.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RankingApp } from "@app/RankingApp.js";
import { chromePlatform } from "./platform.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RankingApp platform={chromePlatform} />
  </StrictMode>,
);
