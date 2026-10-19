import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The basic surface. Flat paper with a hairline rule: no floaty shadows.
 * `tone` tints the top rule with a category accent.
 */
export function Panel({
  className,
  tone,
  children,
  as: Tag = "section",
  ...rest
}: HTMLAttributes<HTMLElement> & { tone?: string; children: ReactNode; as?: "section" | "div" | "article" | "aside" }) {
  return (
    <Tag
      className={cn("relative rounded-[var(--radius-lg)] border border-line bg-raised", className)}
      style={tone ? { borderTop: `3px solid ${tone}` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function Rule({ className, label }: { className?: string; label?: string }) {
  if (!label) return <hr className={cn("border-0 border-t border-line", className)} />;
  return (
    <div className={cn("flex items-center gap-4", className)} role="separator">
      <span className="h-px flex-1 bg-line" />
      <span className="eyebrow text-muted">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function Badge({ children, color, className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.72rem] font-bold uppercase tracking-[0.1em]", className)}
      style={{ color: color ?? "var(--fg-muted)", borderColor: "currentColor" }}
    >
      {children}
    </span>
  );
}