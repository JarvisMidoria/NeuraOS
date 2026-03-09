"use client";

import type {
  ButtonHTMLAttributes,
  ComponentPropsWithoutRef,
  ReactNode,
} from "react";

type ActionIconName =
  | "refresh"
  | "edit"
  | "delete"
  | "save"
  | "close"
  | "apply"
  | "left"
  | "right"
  | "download"
  | "upload"
  | "plus";

type ActionTone = "neutral" | "primary" | "danger";
type ActionSize = "sm" | "md" | "icon";

type ActionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label?: string;
  icon?: ActionIconName;
  tone?: ActionTone;
  size?: ActionSize;
  iconOnly?: boolean;
  children?: ReactNode;
};

function join(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function iconPath(name: ActionIconName) {
  switch (name) {
    case "refresh":
      return (
        <>
          <path d="M20 12A8 8 0 1 1 17.6 6.3" />
          <path d="M20 4V10H14" />
        </>
      );
    case "edit":
      return (
        <>
          <path d="M4 20H8L18 10L14 6L4 16V20Z" />
          <path d="M12 8L16 12" />
        </>
      );
    case "delete":
      return (
        <>
          <path d="M4 7H20" />
          <path d="M9 7V5H15V7" />
          <path d="M7 7L8 19H16L17 7" />
          <path d="M10 11V16" />
          <path d="M14 11V16" />
        </>
      );
    case "save":
      return (
        <>
          <path d="M5 4H16L20 8V20H4V4H5Z" />
          <path d="M8 4V10H15V4" />
          <path d="M8 20V14H16V20" />
        </>
      );
    case "close":
      return (
        <>
          <path d="M6 6L18 18" />
          <path d="M18 6L6 18" />
        </>
      );
    case "apply":
      return <path d="M5 12L10 17L19 7" />;
    case "left":
      return <path d="M15 6L9 12L15 18" />;
    case "right":
      return <path d="M9 6L15 12L9 18" />;
    case "download":
      return (
        <>
          <path d="M12 3V15" />
          <path d="M7 10L12 15L17 10" />
          <path d="M4 20H20" />
        </>
      );
    case "upload":
      return (
        <>
          <path d="M12 15V3" />
          <path d="M7 8L12 3L17 8" />
          <path d="M4 20H20" />
        </>
      );
    case "plus":
      return (
        <>
          <path d="M12 5V19" />
          <path d="M5 12H19" />
        </>
      );
    default:
      return null;
  }
}

export function ActionIcon({
  name,
  className,
}: {
  name: ActionIconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={join("h-4 w-4 shrink-0 fill-none stroke-current", className)}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPath(name)}
    </svg>
  );
}

export function ActionButton({
  label,
  icon,
  tone = "neutral",
  size = "md",
  iconOnly = false,
  className,
  type = "button",
  children,
  ...props
}: ActionButtonProps) {
  const sizeClass =
    size === "icon"
      ? "h-9 w-9 justify-center p-0"
      : size === "sm"
        ? "px-3 py-1.5 text-xs"
        : "px-3.5 py-2 text-sm";

  const toneClass =
    tone === "primary"
      ? "liquid-btn-primary text-white"
      : tone === "danger"
        ? "liquid-pill border-rose-300/40 text-red-600"
        : "liquid-pill text-[var(--admin-text)]";

  const ariaLabel = props["aria-label"] ?? (iconOnly ? label : undefined);

  return (
    <button
      {...props}
      type={type}
      aria-label={ariaLabel}
      className={join(
        "inline-flex items-center gap-1.5 font-medium transition",
        sizeClass,
        toneClass,
        className,
      )}
    >
      {icon ? <ActionIcon name={icon} /> : null}
      {!iconOnly ? (children ?? label) : null}
    </button>
  );
}

export function ActionLinkButton({
  icon,
  label,
  tone = "neutral",
  className,
  ...props
}: Omit<ComponentPropsWithoutRef<"a">, "children"> & {
  icon?: ActionIconName;
  label: string;
  tone?: ActionTone;
}) {
  const toneClass =
    tone === "primary"
      ? "liquid-btn-primary text-white"
      : tone === "danger"
        ? "liquid-pill border-rose-300/40 text-red-600"
        : "liquid-pill text-[var(--admin-text)]";

  return (
    <a
      {...props}
      className={join(
        "inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium transition",
        toneClass,
        className,
      )}
    >
      {icon ? <ActionIcon name={icon} /> : null}
      {label}
    </a>
  );
}
