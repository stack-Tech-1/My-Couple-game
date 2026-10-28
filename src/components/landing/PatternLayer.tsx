"use client";

import { AdireFill, type Motif } from "@/design/adire";

/**
 * Phones only: an adire pattern filling its (positioned) section, with an optional glow on top.
 * The landing page's desktop layout stays as it was for now.
 */
export function PatternLayer({ motif, bg, ink, glow, className }: { motif: Motif; bg: string; ink: string; glow?: string; className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-x-0 bottom-0 -z-10 md:hidden ${className ?? "top-0"}`}>
      <AdireFill motif={motif} bg={bg} ink={ink} />
      {glow ? <div className="absolute inset-0" style={{ background: glow }} /> : null}
    </div>
  );
}
