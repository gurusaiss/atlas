export function LogoMark({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M3 18c1.8-7 7-11.5 14-11.5 6.4 0 11 4 11.6 9.8" />
        <path d="M7.5 20.5c1.2-4.6 4.8-7.7 9.5-7.7 4.3 0 7.5 2.7 8 6.6" opacity=".72" />
        <path d="M12 23c.7-2.6 2.6-4.3 5.2-4.3 2.4 0 4.2 1.5 4.5 3.6" opacity=".48" />
      </g>
      <circle cx="17.2" cy="23.6" r="2.6" className="fill-accent" />
    </svg>
  );
}

export default function Logo({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark />
      <span className="font-display text-[1.375rem] font-semibold leading-none tracking-tight" style={{ fontVariationSettings: '"SOFT" 100, "opsz" 48' }}>
        Atlas
      </span>
    </span>
  );
}
