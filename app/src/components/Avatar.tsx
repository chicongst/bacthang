import { useState } from "react";
import type { TierId } from "../types.js";

const RING: Record<TierId, string> = {
  bronze: "#B87A4E",
  silver: "#AEB9C3",
  gold: "#E0B23C",
  platinum: "#5EC2B7",
  diamond: "#6F9FF0",
  master: "#B77EEA",
};

export function Avatar({ name, url, size = 32, tier }: { name: string; url: string | null | undefined; size?: number; tier?: TierId }) {
  const [broken, setBroken] = useState(false);
  const initial = name.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? "?";
  const style = {
    width: size,
    height: size,
    fontSize: Math.round(size * 0.42),
    boxShadow: tier ? `0 0 0 2px var(--felt-deep), 0 0 0 ${size >= 40 ? 3.5 : 3}px ${RING[tier]}` : undefined,
  };
  return url && !broken ? (
    <img className="avatar" src={url} alt="" style={style} onError={() => setBroken(true)} />
  ) : (
    <span className="avatar avatar-fallback" style={style} aria-hidden="true">
      {initial}
    </span>
  );
}
