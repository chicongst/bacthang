const SPARKS = [
  { top: "-8%", left: "9%", size: 10, delay: "0s" },
  { top: "56%", left: "23%", size: 7, delay: "0.35s" },
  { top: "-5%", left: "41%", size: 8, delay: "0.7s" },
  { top: "60%", left: "57%", size: 6, delay: "1.05s" },
  { top: "-7%", left: "72%", size: 9, delay: "1.4s" },
  { top: "58%", left: "88%", size: 7, delay: "1.75s" },
  { top: "26%", left: "3%", size: 6, delay: "2.1s" },
  { top: "24%", left: "95%", size: 6, delay: "2.45s" },
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
      <path d="M2.5 7.5 7 11.2 12 3.2l5 8L21.5 7.5 19.4 18H4.6L2.5 7.5Z" />
      <rect x="4.4" y="19.2" width="15.2" height="2.2" rx="1.1" />
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
