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
          d="M11 27C11 17 20 10 31 10C41 10 51 15 53 24C55 34 47 39 36 36C30 34 25 31 20 31C16 31 13 33 11 36"
          stroke="url(#neura-stroke)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M18 39C24 34 31 34 38 37C43 40 47 45 47 50"
          stroke="url(#neura-stroke)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M27 49C27 44 30 40 34 38"
          stroke="url(#neura-stroke)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="neura-stroke" x1="10" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop stopColor="#d946ef" />
            <stop offset="1" stopColor="#6366f1" />
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
