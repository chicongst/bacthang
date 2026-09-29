import { useId } from "react";

type Place = 1 | 2 | 3;

// A deep tone of the same metal, never black: black reads as a hole punched behind the
// avatar rather than the shadowed side of a casting.
const COLORS: Record<Place, [rim: string, body: string, deep: string, edge: string]> = {
  1: ["#FFF0BC", "#D9A72C", "#71490A", "#6A4409"],
  2: ["#F4F8FB", "#AEBDC8", "#5C6873", "#59656F"],
  3: ["#F2CBA4", "#C07F4A", "#66381E", "#63361B"],
};

// The rim is dark so the birds can be the bright metal of their tier; gold on gold vanishes.
const PATINA = ["#235544", "#0A2720"];

// The frame is a Dong Son drum face: a dark aged rim between two hairlines of metal.
const CENTRE = { cx: 80, cy: 60 };
const BAND_R = 38.5;
const BIRD_BOX = { w: 40, h: 16 };

// Traced from a rubbing of the bronze, flying right. The beak is a third of the whole
// length: shorten it and the silhouette stops reading as a bird.
const BIRD =
  "M40 4.5L27 6L25.2 5.2L23.2 4L21.8 6.2L17.5 7.2L4 2.5L1.5 4.2L12.8 9.2L0 9.6" +
  "L1.2 11.6L12 12.2L13.6 14.2L15.6 13.6L15 11.8L20 10.6L24.4 7.6L27 7Z";

const FLOCK = { count: 5, radius: 57, scale: 1 };

// The drawing keeps its own 160 by 118 coordinates; the viewBox is larger so the flock
// has air around the disc, and this offset re-centres the old coordinates inside it.
const PAD = { x: 10, y: 7 };
const VIEW = { w: 180, h: 134 };

function birdTransform(index: number): string {
  const angle = (index * 360) / FLOCK.count;
  const x = CENTRE.cx - (BIRD_BOX.w * FLOCK.scale) / 2;
  const y = CENTRE.cy - FLOCK.radius - (BIRD_BOX.h * FLOCK.scale) / 2;
  // The bird is drawn flying right; mirrored so the flock travels beak first around a
  // counterclockwise orbit, the direction they circle on the bronzes.
  const mirror = `translate(${BIRD_BOX.w} 0) scale(-1 1)`;
  return `rotate(${angle} ${CENTRE.cx} ${CENTRE.cy}) translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${FLOCK.scale}) ${mirror}`;
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

export function RankCrest({ place, width, seed }: { place: Place; width: number; seed: number }) {
  const uid = useId().replace(/:/g, "");
  const [rim, body, deep, edge] = COLORS[place];
  const fill = `f${uid}`;
  const gloss = `g${uid}`;
  const patina = `p${uid}`;
  const sparks = sparksFor(seed, place === 1 ? 9 : 5);

  return (
    <svg
      className={`crest crest-${place}`}
      viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
      width={width}
      height={(width * VIEW.h) / VIEW.w}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={rim} />
          <stop offset="0.45" stopColor={body} />
          <stop offset="1" stopColor={deep} />
        </linearGradient>
        <linearGradient id={patina} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={PATINA[0]} />
          <stop offset="1" stopColor={PATINA[1]} />
        </linearGradient>
        <linearGradient id={gloss} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={rim} stopOpacity="0.85" />
          <stop offset="0.55" stopColor={rim} stopOpacity="0" />
        </linearGradient>
      </defs>

      <g transform={`translate(${PAD.x} ${PAD.y})`}>

      <circle {...CENTRE} r={BAND_R} fill="none" stroke={edge} strokeWidth="13.2" />
      <circle {...CENTRE} r={BAND_R} fill="none" stroke={`url(#${patina})`} strokeWidth="12" />
      <circle {...CENTRE} r={32.3} fill="none" stroke={body} strokeWidth="1.6" />
      <circle {...CENTRE} r={44.8} fill="none" stroke={body} strokeWidth="1.6" />

      {place === 1 && (
        // Squashed into an ellipse: a true circle of birds is taller than the crest box
        // and the top and bottom of the flock get clipped. The tilt also reads as
        // perspective, as though the ring were seen at an angle.
        <g transform={`translate(${CENTRE.cx} ${CENTRE.cy}) scale(1 0.72) translate(${-CENTRE.cx} ${-CENTRE.cy})`}>
          <g className="crest-flock">
            {Array.from({ length: FLOCK.count }, (_, i) => (
              <path key={i} d={BIRD} transform={birdTransform(i)} />
            ))}
          </g>
        </g>
      )}

      <g fill={`url(#${fill})`} stroke={edge} strokeWidth="1.6" strokeLinejoin="round">
        <path d={CROWN} />
        <path d={GEM} />
        {/* First place wears no blades: the flock is its wings. */}
        {place !== 1 && (
          <>
            {BLADES.map((d) => (
              <path key={d} d={d} />
            ))}
            <g transform="translate(160 0) scale(-1 1)">
              {BLADES.map((d) => (
                <path key={d} d={d} />
              ))}
            </g>
          </>
        )}
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
        {place !== 1 &&
          BLADES.map((d) => (
            <g key={d}>
              <path d={d} />
              <path d={d} transform="translate(160 0) scale(-1 1)" />
            </g>
          ))}
      </g>
      </g>
    </svg>
  );
}
