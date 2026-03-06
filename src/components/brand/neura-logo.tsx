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
          d="M10 39H44.5C50.9 39 56 33.9 56 27.5C56 21.6 51.5 16.7 45.8 16.1C44.1 12 40 9 35.2 9C31.6 9 28.3 10.8 26.2 13.8C24.6 12.7 22.7 12.1 20.6 12.1C15.4 12.1 11.1 16.4 11.1 21.6C11.1 22.4 11.2 23.2 11.4 24C8.2 25.3 6 28.4 6 32C6 35.9 9.1 39 13 39"
          stroke="url(#neura-stroke)"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M25 23V47"
          stroke="url(#neura-stroke)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M32 18V47"
          stroke="url(#neura-stroke)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M39 27V47"
          stroke="url(#neura-stroke)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M46 39C51.9 39 56.7 34.2 56.7 28.3C56.7 26.1 56 24 54.8 22.3"
          stroke="url(#neura-stroke)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="neura-stroke" x1="8" y1="10" x2="57" y2="47" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F6B24A" />
            <stop offset="1" stopColor="#EC4899" />
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
