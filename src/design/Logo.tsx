import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/cn";

/** Wordmark: two interlocking loops (the two of you) beside the name in Fraunces. */
export function Logo({ className, mark = true }: { className?: string; mark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {mark ? <LogoMark /> : null}
      <span className="display display-wonk text-[1.55rem] leading-none tracking-[-0.04em]">{APP_NAME.toLowerCase()}</span>
    </span>
  );
}

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="12" cy="16" r="7.4" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="20" cy="16" r="7.4" stroke="var(--accent)" strokeWidth="2.2" />
      <path d="M16 10.1a7.4 7.4 0 0 1 0 11.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}