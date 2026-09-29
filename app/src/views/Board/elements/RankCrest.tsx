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

// Right half only, mirrored for the left. Two blades of clearly different lengths,
// because three of them merge into one mass at this size.
const BLADES = [
  "M116 52C134 44 148 34 158 20C154 40 142 56 122 66C122 60 120 55 116 52Z",
  "M118 66C132 62 143 55 151 47C145 60 134 71 120 77C121 72 120 69 118 66Z",
];
const CROWN = "M69 22L74 9L80 17L86 9L91 22C84 19 76 19 69 22Z";
const GEM = "M80 95L87 104L80 113L73 104Z";

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
