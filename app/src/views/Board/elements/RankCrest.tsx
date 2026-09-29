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

const SPARKS = [
  { d: spark(150, 16, 11), delay: "0s" },
  { d: spark(12, 28, 9), delay: "0.4s" },
  { d: spark(126, 74, 8), delay: "0.8s" },
  { d: spark(34, 66, 8.5), delay: "1.2s" },
  { d: spark(46, 16, 7), delay: "1.6s" },
  { d: spark(104, 30, 6), delay: "2s" },
];

export function RankCrest({ place, width }: { place: Place; width: number }) {
  const uid = useId().replace(/:/g, "");
  const [rim, body, deep, edge] = COLORS[place];
  const fill = `f${uid}`;
  const gloss = `g${uid}`;

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

      {SPARKS.map((s) => (
        <path key={s.d} className="crest-spark" d={s.d} style={{ animationDelay: s.delay }} />
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
