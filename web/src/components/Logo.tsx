// Same mark as the home-screen icon in web/public, drawn as SVG so it stays
// crisp at any size — the geometry is deliberately identical, so the login
// screen and the installed app icon read as the same thing.
export function Logo({ size = 64, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="SiteBook"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="100" height="100" rx="22" fill="#0f172a" />
      {/* roof */}
      <path d="M50 29 L77 47.5 L23 47.5 Z" fill="#ffffff" />
      {/* wall */}
      <rect x="31.5" y="47.5" width="37" height="24" fill="#ffffff" />
      {/* floor line, in the app's action colour */}
      <rect x="31.5" y="57.6" width="37" height="5.5" fill="#6366f1" />
    </svg>
  );
}
