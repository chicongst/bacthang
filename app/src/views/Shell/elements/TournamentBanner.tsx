export function TournamentBanner({ name }: { name: string | null }) {
  if (!name) return null;

  return (
    <div className="trophy-banner">
      <span className="trophy-rule" aria-hidden="true" />
      <span className="trophy-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
          <path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />
          <path d="M12 14v4M9 20h6" />
        </svg>
      </span>
      <h2 className="trophy-name">{name}</h2>
      <span className="trophy-mark trophy-mark-right" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
          <path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />
          <path d="M12 14v4M9 20h6" />
        </svg>
      </span>
      <span className="trophy-rule" aria-hidden="true" />
    </div>
  );
}
