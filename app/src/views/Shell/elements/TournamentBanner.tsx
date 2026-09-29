const SPARKS = [
  { top: "-7%", left: "11%", size: 10, delay: "0s" },
  { top: "58%", left: "31%", size: 7, delay: "0.8s" },
  { top: "-4%", left: "58%", size: 8, delay: "1.6s" },
  { top: "62%", left: "84%", size: 9, delay: "2.4s" },
];

export function TournamentBanner({ name }: { name: string | null }) {
  if (!name) return null;

  return (
    <div className="plate-wrap">
      <div className="plate">
        <span className="plate-cap plate-cap-left" aria-hidden="true">
          <Crown />
        </span>

        <span className="plate-face">
          <h2 className="plate-name">{name}</h2>
          <span className="plate-shine" aria-hidden="true" />
        </span>

        <span className="plate-cap plate-cap-right" aria-hidden="true">
          <Star />
        </span>

        {SPARKS.map((spark) => (
          <Spark key={spark.left} {...spark} />
        ))}
      </div>
    </div>
  );
}

function Crown() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 9l4 3 5-7 5 7 4-3-2 10H5L3 9Z" />
      <path d="M5 19h14" />
    </svg>
  );
}

/** A star, not crossed cues: at 16px the cues read as a smudged X. */
function Star() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l2.6 6.1 6.4.5-4.9 4.2 1.5 6.2L12 16.8 6.4 20l1.5-6.2L3 9.6l6.4-.5L12 3Z" />
    </svg>
  );
}

function Spark({ top, left, size, delay }: { top: string; left: string; size: number; delay: string }) {
  return (
    <svg
      className="plate-spark"
      viewBox="0 0 12 12"
      aria-hidden="true"
      style={{ top, left, width: size, height: size, animationDelay: delay }}
    >
      <path d="M6 0c.5 3.6 1.9 5 5.5 6-3.6 1-5 2.4-5.5 6-.5-3.6-1.9-5-5.5-6 3.6-1 5-2.4 5.5-6Z" />
    </svg>
  );
}
