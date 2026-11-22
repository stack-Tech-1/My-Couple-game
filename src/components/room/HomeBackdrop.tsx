"use client";

import { AdireFill, type Motif } from "@/design/adire";
import { INDIGO_LOOK } from "@/games/look";
import { Selvedge } from "@/design/wax";

/**
 * Phones: the page's own adire runs behind its title as one clean band, edged with the selvedge,
 * and the page carries on in plain calico below. `height` is the old fade height; the band takes
 * the top two fifths of it unless `band` says exactly how tall it is. With `fit`, the band
 * fills its parent instead (wrap the title block, give it bottom padding for the selvedge), and
 * `reach` lets it run up behind anything above. The parent must be `relative isolate`.
 */
export function PageBackdrop({ motif, bg, ink, height = 640, band, fit, reach = 40 }: { motif: Motif; bg: string; ink: string; glow?: string; height?: number; band?: number; fit?: boolean; reach?: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -inset-x-4 -z-10 overflow-hidden sm:hidden"
      style={fit ? { top: -reach, bottom: 0 } : { top: -40, height: band ?? Math.round(height * 0.4) }}
    >
      <AdireFill motif={motif} bg={bg} ink={ink} />
      <div className="absolute inset-x-0 bottom-0">
        <Selvedge />
      </div>
    </div>
  );
}

/** The room home: indigo agbole (the family home), an ember glow top right and a little gold. */
export function HomeBackdrop() {
  return (
    <PageBackdrop
      motif="agbole"
      bg={INDIGO_LOOK.bg}
      ink={INDIGO_LOOK.ink}
      height={680}
      glow="radial-gradient(70% 40% at 92% 4%, rgba(232,86,58,.55), transparent 70%), radial-gradient(60% 35% at 0% 42%, rgba(242,183,5,.22), transparent 70%)"
    />
  );
}
