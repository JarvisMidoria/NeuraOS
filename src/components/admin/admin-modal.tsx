"use client";

import { useEffect } from "react";
import { ActionButton } from "@/components/admin/action-button";

type AdminModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidthClassName?: string;
};

export function AdminModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidthClassName = "max-w-3xl",
}: AdminModalProps) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="admin-modal-overlay absolute inset-0"
        onClick={onClose}
        aria-label="Close modal"
      />
      <div className={`admin-modal relative z-[171] w-full ${maxWidthClassName} rounded-2xl p-4 sm:p-5`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-zinc-500">{subtitle}</p> : null}
          </div>
          <ActionButton
            type="button"
            icon="close"
            size="icon"
            iconOnly
            onClick={onClose}
            label="Close"
            title="Close"
          />
        </div>
        {children}
      </div>
    </div>
  );
}
