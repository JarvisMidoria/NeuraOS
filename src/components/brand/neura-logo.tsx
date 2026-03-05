import Link from "next/link";

type NeuraLogoProps = {
  href?: string;
  compact?: boolean;
  className?: string;
};

export function NeuraLogo({ href = "/", compact = false, className = "" }: NeuraLogoProps) {
  const content = (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        aria-hidden
        viewBox="0 0 32 32"
        className="h-7 w-7"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="1" y="1" width="30" height="30" rx="8" fill="url(#neura-bg)" />
        <path
          d="M12 11.5C10.34 11.5 9 12.84 9 14.5C9 15.79 9.81 16.89 10.95 17.33V19.1C10.95 20.19 11.83 21.07 12.92 21.07H14.15M20 11.5C21.66 11.5 23 12.84 23 14.5C23 15.79 22.19 16.89 21.05 17.33V19.1C21.05 20.19 20.17 21.07 19.08 21.07H17.85"
          stroke="#DDE3FF"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path d="M16 10V22" stroke="#DDE3FF" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="13.2" cy="14.5" r="1.2" fill="#DDE3FF" />
        <circle cx="18.8" cy="14.5" r="1.2" fill="#DDE3FF" />
        <circle cx="16" cy="18.6" r="1.2" fill="#DDE3FF" />
        <defs>
          <linearGradient id="neura-bg" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6F7FFF" />
            <stop offset="1" stopColor="#4F5CC8" />
          </linearGradient>
        </defs>
      </svg>
      {!compact ? (
        <span className="text-sm font-semibold tracking-tight text-zinc-100">NeuraOS</span>
      ) : null}
    </span>
  );

  return (
    <Link href={href} className="inline-flex items-center" aria-label="NeuraOS">
      {content}
    </Link>
  );
}
