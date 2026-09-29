import { useId } from "react";
import type { TierId } from "../types.js";

const COLORS: Record<TierId, [light: string, dark: string]> = {
  bronze: ["#D9A274", "#6E3E22"],
  silver: ["#E6ECF1", "#6F7C88"],
  gold: ["#F7D878", "#9C6A0C"],
  platinum: ["#A6E8DE", "#26716C"],
  diamond: ["#B1D1FF", "#2A57B8"],
  master: ["#E6BDFF", "#5F2AA3"],
};

const LEVEL: Record<TierId, number> = { bronze: 1, silver: 2, gold: 3, platinum: 4, diamond: 5, master: 6 };

export function TierBadge({ tier, size = 32, title }: { tier: TierId; size?: number; title?: string }) {
  const uid = useId().replace(/:/g, "");
  const [light, dark] = COLORS[tier];
  const level = LEVEL[tier];
  const g = `g${uid}`;
  const s = `s${uid}`;

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={title ?? tier} className="tier-badge">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <linearGradient id={s} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={dark} />
          <stop offset="1" stopColor="#0B2720" />
        </linearGradient>
      </defs>

      {level >= 4 && (
        <g fill={`url(#${g})`} opacity="0.95">
          <path d="M10 15 L1 11 L4 20 L0 24 L6 27 L4 32 L11 31 Z" />
          <path d="M38 15 L47 11 L44 20 L48 24 L42 27 L44 32 L37 31 Z" />
        </g>
      )}

      <path d="M24 4 L40 10 V23 C40 33 33 40.5 24 44.5 C15 40.5 8 33 8 23 V10 Z" fill={`url(#${g})`} />
      <path d="M24 9 L35.5 13.4 V23 C35.5 30.6 30.4 36 24 39.2 C17.6 36 12.5 30.6 12.5 23 V13.4 Z" fill={`url(#${s})`} />

      {level <= 3 &&
        Array.from({ length: level }, (_, i) => (
          <path
            key={i}
            d={`M17 ${18 + i * 5.5} L24 ${22.5 + i * 5.5} L31 ${18 + i * 5.5}`}
            fill="none"
            stroke={light}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

      {level === 4 && <circle cx="24" cy="24" r="5.5" fill="none" stroke={light} strokeWidth="2.6" />}

      {level >= 5 && <path d="M24 15.5 L30 23 L24 32 L18 23 Z" fill={light} />}
      {level >= 5 && <path d="M24 15.5 L30 23 L24 23.8 Z" fill="#fff" opacity="0.45" />}

      {level === 6 && <path d="M16 6.5 L19.5 1.5 L24 5 L28.5 1.5 L32 6.5 L24 8.6 Z" fill={light} />}
    </svg>
  );
}
