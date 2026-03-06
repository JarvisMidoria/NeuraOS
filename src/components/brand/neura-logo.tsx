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
        viewBox="0 0 64 64"
        className="h-7 w-7"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M32 8V56"
          stroke="url(#neura-stroke)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M32 10C20.4 10 11 19.4 11 31C11 42.6 20.4 52 32 52"
          stroke="url(#neura-stroke)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M32 10C43.6 10 53 19.4 53 31C53 42.6 43.6 52 32 52"
          stroke="url(#neura-stroke)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M18 22C21 21 22.7 19 22.7 16.2"
          stroke="url(#neura-stroke)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M16.5 31H23.5"
          stroke="url(#neura-stroke)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M18 40C21 41 22.7 43 22.7 45.8"
          stroke="url(#neura-stroke)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M25.5 20.5C27 23 27 26 25.5 28"
          stroke="url(#neura-stroke)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M25.5 34C27 36 27 39 25.5 42"
          stroke="url(#neura-stroke)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M41 18L45 20"
          stroke="url(#neura-stroke)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M41 31H46"
          stroke="url(#neura-stroke)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M41 44L45 42"
          stroke="url(#neura-stroke)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <circle cx="47.5" cy="21" r="2" fill="url(#neura-stroke)" />
        <circle cx="48.5" cy="31" r="2" fill="url(#neura-stroke)" />
        <circle cx="47.5" cy="41" r="2" fill="url(#neura-stroke)" />
        <path
          d="M36.5 23C39 24.5 39 27.5 36.5 29"
          stroke="url(#neura-stroke)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M36.5 34C39 35.5 39 38.5 36.5 40"
          stroke="url(#neura-stroke)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="neura-stroke" x1="11" y1="10" x2="53" y2="52" gradientUnits="userSpaceOnUse">
            <stop stopColor="#A855F7" />
            <stop offset="1" stopColor="#7C3AED" />
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
