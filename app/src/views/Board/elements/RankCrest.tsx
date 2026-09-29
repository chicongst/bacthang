import { useId } from "react";

type Place = 1 | 2 | 3;

const COLORS: Record<Place, [rim: string, body: string, deep: string, edge: string]> = {
  1: ["#FFF0BC", "#D9A72C", "#71490A", "#2B1B02"],
  2: ["#F4F8FB", "#AEBDC8", "#5C6873", "#1D242B"],
  3: ["#F2CBA4", "#C07F4A", "#66381E", "#26130A"],
};

// The ring is what makes this read as a frame instead of two wings stuck on the sides.
// Everything else hangs off it: blades at the equator, a crown on top, a gem below.
const RING = { cx: 80, cy: 60, r: 40 };

// Right half only, mirrored for the left. Three short blades with sharp tips: long
// sweeping curves read as two fat leaves, short ones read as a folded wing.
const BLADES = [
  "M114 47C126 41 136 34 147 23C143 37 135 47 122 56C121 52 118 49 114 47Z",
  "M116 58C127 54 135 48 143 40C139 52 131 61 121 67C121 63 119 60 116 58Z",
  "M118 68C126 66 133 62 139 55C136 65 130 72 122 78C122 74 120 70 118 68Z",
];
const CROWN = "M69 22L74 9L80 17L86 9L91 22C84 19 76 19 69 22Z";
const GEM = "M80 95L87 104L80 113L73 104Z";

const spark = (x: number, y: number, r: number) =>
  `M${x} ${y - r}Q${x + r * 0.26} ${y - r * 0.26} ${x + r} ${y}` +
  `Q${x + r * 0.26} ${y + r * 0.26} ${x} ${y + r}` +
  `Q${x - r * 0.26} ${y + r * 0.26} ${x - r} ${y}` +
  `Q${x - r * 0.26} ${y - r * 0.26} ${x} ${y - r}Z`;

/**
 * Seeded, not Math.random(): the board re-renders on every live event, and a fresh
 * roll each time would make the sparks jump around. Same player, same constellation.
 */
function rng(seed: number): () => number {
  let state = (seed * 2654435761) % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
}

function sparksFor(seed: number, count: number) {
  const next = rng(seed + 7);
  return Array.from({ length: count }, () => {
    const angle = next() * Math.PI * 2;
    const distance = 46 + next() * 26;
    return {
      d: spark(80 + Math.cos(angle) * distance, 60 + Math.sin(angle) * distance * 0.76, 5 + next() * 6),
      delay: `${(next() * 2.6).toFixed(2)}s`,
      duration: `${(2.2 + next() * 1.3).toFixed(2)}s`,
    };
  });
}

// The winner gets a ray burst behind the crest. Twelve wedges, rotating slowly.
const RAYS = Array.from({ length: 12 }, (_, i) => i * 30);

export function RankCrest({ place, width, seed }: { place: Place; width: number; seed: number }) {
  const uid = useId().replace(/:/g, "");
  const [rim, body, deep, edge] = COLORS[place];
  const fill = `f${uid}`;
  const gloss = `g${uid}`;
  const sparks = sparksFor(seed, place === 1 ? 9 : 5);

  return (
    <svg
      className={`crest crest-${place}`}
      viewBox="0 0 160 118"
      width={width}
      height={(width * 118) / 160}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={rim} />
          <stop offset="0.45" stopColor={body} />
          <stop offset="1" stopColor={deep} />
        </linearGradient>
        <linearGradient id={gloss} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={rim} stopOpacity="0.85" />
          <stop offset="0.55" stopColor={rim} stopOpacity="0" />
        </linearGradient>
      </defs>

      {place === 1 && (
        <g className="crest-rays">
          {RAYS.map((angle) => (
            <path key={angle} d="M80 60L77 4L83 4Z" transform={`rotate(${angle} 80 60)`} />
          ))}
        </g>
      )}

      <circle {...RING} fill="none" stroke={edge} strokeWidth="7.5" />
      <circle {...RING} fill="none" stroke={`url(#${fill})`} strokeWidth="4.5" />

      <g fill={`url(#${fill})`} stroke={edge} strokeWidth="1.6" strokeLinejoin="round">
        <path d={CROWN} />
        <path d={GEM} />
        {BLADES.map((d) => (
          <path key={d} d={d} />
        ))}
        <g transform="translate(160 0) scale(-1 1)">
          {BLADES.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </g>

      {sparks.map((s) => (
        <path
          key={s.d}
          className="crest-spark"
          d={s.d}
          style={{ animationDelay: s.delay, animationDuration: s.duration }}
        />
      ))}

      <g fill={`url(#${gloss})`} stroke="none">
        <path d={CROWN} />
        {BLADES.map((d) => (
          <path key={d} d={d} />
        ))}
        <g transform="translate(160 0) scale(-1 1)">
          {BLADES.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </g>
    </svg>
  );
}
