/** Blue verified tick: blue filled badge, white check — required by the site owner. */
export function VerifiedBadge({
  className = "size-3.5",
  label = "Verified",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={`verified-badge ${className}`} role="img" aria-label={label}>
      <path
        className="verified-badge-bg"
        d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
      />
      <path
        className="verified-badge-tick"
        d="m9 12 2 2 4-4"
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
