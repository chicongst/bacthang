import { createContext, useContext } from "react";
import type { Platform } from "./platform.js";

export const PlatformContext = createContext<Platform | null>(null);

export function usePlatform(): Platform {
  const p = useContext(PlatformContext);
  if (!p) throw new Error("PlatformContext is missing");
  return p;
}
