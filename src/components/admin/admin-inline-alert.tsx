import type { ReactNode } from "react";

type AdminInlineAlertProps = {
  tone?: "success" | "error" | "warning" | "info";
  children: ReactNode;
  className?: string;
};

const ALERT_TONE_CLASSES: Record<NonNullable<AdminInlineAlertProps["tone"]>, string> = {
  success: "border-emerald-400/45 bg-emerald-500/10",
  error: "border-rose-400/45 bg-rose-500/10",
  warning: "border-amber-400/45 bg-amber-500/10",
  info: "border-[var(--admin-border)] bg-[var(--admin-soft-bg)]",
};

export function AdminInlineAlert({ tone = "info", children, className = "" }: AdminInlineAlertProps) {
  return (
    <div
      role="status"
      className={`liquid-surface rounded-xl border px-4 py-2 text-sm text-[var(--admin-text)] ${ALERT_TONE_CLASSES[tone]} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
