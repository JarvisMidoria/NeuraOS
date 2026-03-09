"use client";

import type {
  ComponentPropsWithoutRef,
  InputHTMLAttributes,
  SelectHTMLAttributes,
} from "react";

function join(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type ToolbarAlign = "start" | "end";

export function AdminToolbar({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return <div {...props} className={join("admin-toolbar", className)} />;
}

export function AdminToolbarGroup({
  align = "start",
  className,
  ...props
}: ComponentPropsWithoutRef<"div"> & { align?: ToolbarAlign }) {
  return (
    <div
      {...props}
      className={join(
        "admin-toolbar-group",
        align === "end" && "md:justify-end",
        className,
      )}
    />
  );
}

export function AdminToolbarInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={join("admin-toolbar-control", className)} />;
}

export function AdminToolbarSelect({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={join("admin-toolbar-control", className)} />;
}
