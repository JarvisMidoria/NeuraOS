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
          d="M14 36C8.5 36 4 31.5 4 26C4 20.5 8.5 16 14 16C15.6 16 17.1 16.4 18.5 17.1C20.4 12.2 25 8.8 30.5 8.8C35.8 8.8 40.3 11.9 42.4 16.5C43.9 15.8 45.6 15.4 47.4 15.4C53.9 15.4 59.2 20.7 59.2 27.2C59.2 33.7 53.9 39 47.4 39H14Z"
          stroke="url(#neura-stroke)"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M31.6 13.5V41.8"
          stroke="url(#neura-stroke)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M31.6 28.2C28.6 25.4 28.6 21.1 31.6 18.3"
          stroke="url(#neura-stroke)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M31.6 33.4C28.8 36.2 28.8 40.4 31.6 43.2"
          stroke="url(#neura-stroke)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M25.1 20.5C22.4 22.8 22.1 26.5 24.5 29"
          stroke="url(#neura-stroke)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M24.5 29L19.8 26.8"
          stroke="url(#neura-stroke)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M24.8 34.2C22.2 36.4 22 40.2 24.5 42.7"
          stroke="url(#neura-stroke)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M24.8 34.2L20.2 36.4"
          stroke="url(#neura-stroke)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M38.7 19.2C41.3 21 41.8 24.7 40 27.3"
          stroke="url(#neura-stroke)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M40 27.3L45.2 25.6"
          stroke="url(#neura-stroke)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M38.9 34.2C41.4 36.2 41.8 39.9 39.8 42.4"
          stroke="url(#neura-stroke)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M38.9 34.2L44.2 36"
          stroke="url(#neura-stroke)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <circle cx="46.8" cy="25.2" r="2.2" fill="url(#neura-stroke)" />
        <circle cx="44.8" cy="36.4" r="2.2" fill="url(#neura-stroke)" />
        <circle cx="20" cy="26.8" r="2.2" fill="url(#neura-stroke)" />
        <circle cx="20.2" cy="36.4" r="2.2" fill="url(#neura-stroke)" />
        <path
          d="M31.6 28.2L27.8 29.4"
          stroke="url(#neura-stroke)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M31.6 33.4L27.8 34.8"
          stroke="url(#neura-stroke)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="neura-stroke" x1="9" y1="12" x2="53" y2="49" gradientUnits="userSpaceOnUse">
            <stop stopColor="#A855F7" />
            <stop offset="1" stopColor="#6D28D9" />
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
