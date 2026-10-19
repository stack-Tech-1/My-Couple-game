import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icons";

type Variant = "primary" | "accent" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  children?: ReactNode;
};

const base =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold " +
  "rounded-full transition-[transform,background-color,color,box-shadow,border-color] duration-150 ease-out " +
  "active:translate-y-[1px] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-45";

const variants: Record<Variant, string> = {
  primary: "bg-fg text-bg hover:bg-[color-mix(in_srgb,var(--fg)_86%,var(--accent))] shadow-[inset_0_-2px_0_rgba(0,0,0,.25)]",
  accent: "bg-accent text-on-accent hover:brightness-[1.06] shadow-[inset_0_-2px_0_rgba(0,0,0,.18)]",
  outline: "border-[1.5px] border-line-strong text-fg hover:bg-fg hover:text-bg",
  ghost: "text-fg hover:bg-sunk",
  danger: "border-[1.5px] border-accent-ink text-accent-ink hover:bg-accent-ink hover:text-bg",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[0.85rem]",
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-14 px-7 text-[1.05rem]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon, iconRight, loading, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : icon ? <Icon name={icon} size={size === "lg" ? 22 : 18} /> : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={size === "lg" ? 22 : 18} /> : null}
    </button>
  );
});

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("h-4 w-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3a9 9 0 1 0 9 9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** Square icon-only button. A label is mandatory for screen readers. */
export function IconButton({
  icon,
  label,
  className,
  size = 40,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; size?: number }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center rounded-full text-fg transition-colors hover:bg-sunk active:scale-95",
        className,
      )}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} />
    </button>
  );
}