"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { CampOperationDialog } from "@/components/camp/camp-operation-dialog";

type Tone = "default" | "ready" | "warn" | "locked";

function joinClassNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function CampCard({
  children,
  className,
  accent,
  ...props
}: ComponentPropsWithoutRef<"section"> & { accent?: "medical" | "warning" | "team" }) {
  return (
    <section className={joinClassNames("camp-card", accent ? `camp-card-${accent}` : null, className)} {...props}>
      {children}
    </section>
  );
}

export const CampModal = CampOperationDialog;
export const CampDrawer = CampOperationDialog;

export function CampBadge({ children, tone = "default" }: { children: ReactNode; tone?: Tone }) {
  return <span className={tone === "default" ? "camp-badge" : `camp-badge ${tone}`}>{children}</span>;
}

export function CampStatusChip({ children, tone }: { children: ReactNode; tone?: Exclude<Tone, "default"> }) {
  return <span className={tone ? `camp-status ${tone}` : "camp-status"}>{children}</span>;
}

export function CampActionButton({
  children,
  href,
  className,
  variant = "default",
  ...props
}: ComponentPropsWithoutRef<"button"> & { href?: string; variant?: "default" | "primary" | "compact" }) {
  const classes = joinClassNames(
    "button",
    variant === "primary" ? "primary" : null,
    variant === "compact" ? "compact-button" : null,
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}

export function CampSectionHeader({ title, meta }: { title: string; meta?: ReactNode }) {
  return (
    <header className="camp-cc-section-head">
      <h2>{title}</h2>
      {meta ? <span className="camp-cc-muted">{meta}</span> : null}
    </header>
  );
}

export function CampBottomSafeArea() {
  return <div className="camp-bottom-safe-area" aria-hidden="true" />;
}
