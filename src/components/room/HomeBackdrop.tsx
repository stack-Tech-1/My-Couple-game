"use client";

import { AdireFill, type Motif } from "@/design/adire";
import { INDIGO_LOOK } from "@/games/look";

/**
 * Phones: an adire pattern runs behind the top of a page and melts into the page colour, so the
 * glass cards above it have something to glow over. Each page brings its own colour and motif.
 * The parent must be `relative isolate`.
 */
export function PageBackdrop({ motif, bg, ink, glow, height = 640 }: { motif: Motif; bg: string; ink: string; glow: string; height?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute -inset-x-4 -top-10 -z-10 overflow-hidden sm:hidden" style={{ height }}>
      <AdireFill motif={motif} bg={bg} ink={ink} />
      <div
        className="absolute inset-0"
        style={{ background: `${glow}, linear-gradient(180deg, transparent 0%, transparent 42%, color-mix(in srgb, var(--bg) 94%, transparent) 84%, var(--bg) 100%)` }}
      />
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
