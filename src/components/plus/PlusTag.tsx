import type { ReactNode } from "react";
import { AdireFill } from "@/design/adire";
import { cn } from "@/lib/cn";

/** Amah Plus colours: gold on deep purple, with the adire crown (ade). */
export const PLUS = { bg: "#2a1f4e", ink: "#3d2f70", gold: "#d9a43a", goldLight: "#f6d26a", cream: "#f6efe6" } as const;

export function Crown({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} className={className}>
      <path d="M3 18 L3 8 L8 12 L12 5 L16 12 L21 8 L21 18 Z" fill="currentColor" />
    </svg>
  );
}

/** The small gold "Plus" pill on paid games and features. */
export function PlusTag({ label = "Plus", className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full py-[3px] pl-1.5 pr-2 text-[0.7rem] font-extrabold leading-none text-[#2a1f4e] shadow-[0_0_0_1px_rgba(42,31,78,.25)]", className)}
      style={{ background: `linear-gradient(135deg, ${PLUS.goldLight}, ${PLUS.gold})` }}
    >
      <Crown size={11} />
      {label}
    </span>
  );
}

/** The crown-pattern block Plus screens open with. */
export function PlusPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden text-[#f6efe6]", className)}>
      <AdireFill motif="ade" bg={PLUS.bg} ink={PLUS.ink} />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(70% 90% at 100% 0%, rgba(217,164,58,.42), transparent 70%)" }} />
      <div className="relative">{children}</div>
    </div>
  );
}

/** Gold button styles, for the one main Plus action on a screen. */
export const goldButton =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-6 font-extrabold text-[#2a1f4e] shadow-[0_12px_26px_-12px_rgba(217,164,58,.9)] transition-[filter,transform] hover:brightness-[1.05] active:translate-y-[1px] disabled:opacity-50";
export const goldStyle = { background: `linear-gradient(135deg, ${PLUS.goldLight}, ${PLUS.gold})` };
