import { useId } from "react";

type Place = 1 | 2 | 3;

const COLORS: Record<Place, [rim: string, body: string, deep: string, edge: string]> = {
  1: ["#FFF0BC", "#D9A72C", "#71490A", "#2B1B02"],
  2: ["#F4F8FB", "#AEBDC8", "#5C6873", "#1D242B"],
  3: ["#F2CBA4", "#C07F4A", "#66381E", "#26130A"],
};

// The frame is a Dong Son drum face: a banded rim carrying Lac birds, the long-beaked
// herons that circle every real drum. They fly counterclockwise on the bronzes, so they
// fly counterclockwise here. Six of them, not ten: at this size ten become texture.
const CENTRE = { cx: 80, cy: 60 };
const BAND_R = 38.5;
const BIRDS = 4;
const BIRD_SCALE = 1;
const BIRD_BOX = { w: 34, h: 12 };

// The real bird is long and thin, roughly three to one. A stubbier drawing reads as an
// arrowhead at this size, which is what the first two attempts looked like.
const BIRD_BODY =
  "M0 6.1L9.6 4.7L12 3.5L14 4.3L22 5.7L34 2.5L26.6 6.5L33 9.7L21.6 8.1L12 7.3L9.4 6.9Z";
const BIRD_WING = "M14.5 4.4L19.5 -2.9L22.4 5.1Z";
const BIRD_LEGS = "M19.6 7.5L26.6 10.9L25 11.3L19 8Z";

function birdTransform(index: number): string {
  const angle = (index * 360) / BIRDS;
  const x = CENTRE.cx - (BIRD_BOX.w * BIRD_SCALE) / 2;
  const y = CENTRE.cy - BAND_R - (BIRD_BOX.h * BIRD_SCALE) / 2;
  return `rotate(${angle} ${CENTRE.cx} ${CENTRE.cy}) translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${BIRD_SCALE})`;
}

// Right half only, mirrored for the left. Roots clear the drum rim; tips stay inside
// the viewBox so nothing is clipped.
const BLADES = [
  "M129 48C140 43 148 36 156 25C152 38 145 47 136 55C135 52 132 50 129 48Z",
  "M131 58C140 55 146 50 152 43C148 53 142 60 134 66C134 62 133 60 131 58Z",
  "M132 67C139 65 144 62 148 57C146 65 141 70 135 75C135 71 134 69 132 67Z",
];
const CROWN = "M69 14L74 2L80 10L86 2L91 14C84 11 76 11 69 14Z";
const GEM = "M80 100L86.5 108L80 116L73.5 108Z";

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
    const distance = 50 + next() * 24;
    return {
      d: spark(80 + Math.cos(angle) * distance, 60 + Math.sin(angle) * distance * 0.72, 5 + next() * 6),
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

      <circle
        {...CENTRE}
        r={48.5}
        fill="none"
        stroke={`url(#${fill})`}
        strokeWidth="2"
        strokeDasharray="1.4 3.6"
        strokeLinecap="round"
      />
      <circle {...CENTRE} r={BAND_R} fill="none" stroke={edge} strokeWidth="14.5" />
      <circle {...CENTRE} r={BAND_R} fill="none" stroke={`url(#${fill})`} strokeWidth="12" />
      <g fill={edge}>
        {Array.from({ length: BIRDS }, (_, i) => (
          <g key={i} transform={birdTransform(i)}>
            <path d={BIRD_BODY} />
            <path d={BIRD_WING} />
            <path d={BIRD_LEGS} />
          </g>
        ))}
      </g>
      <circle {...CENTRE} r={32.3} fill="none" stroke={edge} strokeWidth="1.4" />
      <circle {...CENTRE} r={44.8} fill="none" stroke={edge} strokeWidth="1.4" />

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
