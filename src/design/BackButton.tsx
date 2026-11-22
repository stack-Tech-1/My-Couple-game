import Link from "next/link";
import type { MouseEvent } from "react";
import { Icon } from "./icons";
import { cn } from "@/lib/cn";

/**
 * The way back from any game screen: top left, always says where it goes. `onClick` can stop
 * the trip (to ask first when a run would be lost).
 */
export function BackButton({ href, label, onClick, className }: { href: string; label: string; onClick?: (e: MouseEvent<HTMLAnchorElement>) => void; className?: string }) {
  return (
    <Link
      prefetch={false}
      href={href}
      onClick={onClick}
      className={cn("cut-sm inline-flex max-w-[60vw] items-center gap-1.5 border border-line bg-raised px-3.5 py-2 text-[0.9rem] font-semibold text-fg", className)}
    >
      <Icon name="arrowLeft" size={16} className="shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
