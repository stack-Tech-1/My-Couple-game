import { useId, type ReactNode } from "react";

/**
 * Adire: Amah's pattern language. Simplified, original drawings after motifs from Yoruba adire
 * cloth (eleko starch-resist and oniko tie-resist), each chosen for what it's said to mean:
 *
 * - oniko: tie-dye rings, the classic tied-cloth look. Our everyday texture.
 * - agbole: concentric rectangles round a circle. The family home and close bonds.
 * - olokoto: spirals. Life's cycle, growing from small beginnings.
 * - ilu: squares split into light and dark triangles (Ilu Gangan, the talking drum). Festivity.
 * - dundun: a square cut into eight triangles. Celebration and joy.
 * - isan: waves (Isan Okun). Continuity, depth.
 * - digi: blocks of diagonal hatching (the mirror). Self-reflection.
 * - oko: a canoe carrying its load. Settle differences and grow together.
 * - iye: feathers. Reaching your goal quickly.
 * - owo: cowries. Wealth and plenty.
 * - ade: rows of crown triangles. Status, the crown.
 * - ogbo: concentric squares. Long life.
 */
export type Motif = "oniko" | "agbole" | "olokoto" | "ilu" | "dundun" | "isan" | "digi" | "oko" | "iye" | "owo" | "ade" | "ogbo";

type Tile = { size: number; draw: (ink: string) => ReactNode };

const ring = (cx: number, cy: number, r: number, ink: string, w: number) => <circle cx={cx} cy={cy} r={r} fill="none" stroke={ink} strokeWidth={w} />;

/** An even spiral, two and a half turns out from the middle of a 52 tile. */
const SPIRAL = (() => {
  const pts: string[] = [];
  for (let i = 0; i <= 90; i++) {
    const t = (i / 90) * Math.PI * 5;
    const r = 1.5 + (t / (Math.PI * 5)) * 17;
    pts.push(`${(26 + r * Math.cos(t)).toFixed(1)} ${(26 + r * Math.sin(t)).toFixed(1)}`);
  }
  return `M${pts.join(" L")}`;
})();

const TILES: Record<Motif, Tile> = {
  oniko: {
    size: 44,
    draw: (ink) => (
      <>
        {ring(22, 22, 11, ink, 3)}
        <circle cx={22} cy={22} r={4} fill={ink} />
        {[0, 44].flatMap((x) => [0, 44].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r={5} fill={ink} opacity={0.7} />))}
      </>
    ),
  },
  agbole: {
    size: 56,
    draw: (ink) => (
      <>
        <rect x={6} y={6} width={44} height={44} rx={2} fill="none" stroke={ink} strokeWidth={2.5} />
        <rect x={14} y={14} width={28} height={28} rx={1.5} fill="none" stroke={ink} strokeWidth={2.5} />
        <circle cx={28} cy={28} r={5.5} fill={ink} />
      </>
    ),
  },
  olokoto: {
    size: 52,
    draw: (ink) => <path d={SPIRAL} fill="none" stroke={ink} strokeWidth={2.6} strokeLinecap="round" />,
  },
  ilu: {
    size: 40,
    draw: (ink) => (
      <>
        <path d="M0 0H20L0 20Z M20 20H40L20 40Z" fill={ink} />
        <path d="M20 0H40V20Z M0 20V40H20Z" fill={ink} opacity={0.45} />
      </>
    ),
  },
  dundun: {
    size: 48,
    draw: (ink) => (
      <>
        <path d="M24 24L4 4H24Z M24 24L44 4V24Z M24 24L44 44H24Z M24 24L4 44V24Z" fill={ink} />
        <rect x={4} y={4} width={40} height={40} fill="none" stroke={ink} strokeWidth={2} />
      </>
    ),
  },
  isan: {
    size: 48,
    draw: (ink) => (
      <>
        <path d="M0 12 q12 -10 24 0 t24 0 M0 28 q12 -10 24 0 t24 0" fill="none" stroke={ink} strokeWidth={2.6} />
        <circle cx={24} cy={42} r={2.4} fill={ink} />
        <circle cx={0} cy={42} r={2.4} fill={ink} />
        <circle cx={48} cy={42} r={2.4} fill={ink} />
      </>
    ),
  },
  digi: {
    size: 40,
    draw: (ink) => (
      <g stroke={ink} strokeWidth={2.2}>
        <path d="M2 10L10 2 M2 18L18 2" />
        <path d="M22 22L38 38 M22 30L30 38" />
        <path d="M22 2L38 18 M30 2L38 10" opacity={0.55} />
        <path d="M2 22L18 38 M2 30L10 38" opacity={0.55} />
      </g>
    ),
  },
  oko: {
    size: 60,
    draw: (ink) => (
      <>
        <path d="M8 34 Q30 48 52 34 Z" fill={ink} />
        <circle cx={30} cy={28} r={6} fill="none" stroke={ink} strokeWidth={2.5} />
        <path d="M6 52 h10 M24 52 h12 M44 52 h10" stroke={ink} strokeWidth={2.2} opacity={0.6} />
      </>
    ),
  },
  iye: {
    size: 40,
    draw: (ink) => (
      <g fill="none" stroke={ink} strokeWidth={2.3} strokeLinecap="round">
        <path d="M20 4 V36" />
        <path d="M20 10 L11 6 M20 18 L11 14 M20 26 L11 22 M20 10 L29 6 M20 18 L29 14 M20 26 L29 22" />
      </g>
    ),
  },
  owo: {
    size: 40,
    draw: (ink) => (
      <>
        <ellipse cx={20} cy={20} rx={9} ry={12} fill={ink} />
        <path d="M20 11 V29" stroke="var(--adire-bg)" strokeWidth={2} strokeDasharray="2 2.5" />
        <circle cx={0} cy={0} r={3} fill={ink} opacity={0.6} />
        <circle cx={40} cy={40} r={3} fill={ink} opacity={0.6} />
      </>
    ),
  },
  ade: {
    size: 36,
    draw: (ink) => (
      <>
        <path d="M2 30 L9 12 L16 30 Z M20 30 L27 12 L34 30 Z" fill={ink} />
        <path d="M0 34 H36" stroke={ink} strokeWidth={2} />
        <circle cx={9} cy={6} r={2} fill={ink} />
        <circle cx={27} cy={6} r={2} fill={ink} />
      </>
    ),
  },
  ogbo: {
    size: 44,
    draw: (ink) => (
      <g fill="none" stroke={ink} strokeWidth={2.4}>
        <rect x={4} y={4} width={36} height={36} />
        <rect x={12} y={12} width={20} height={20} />
        <rect x={19} y={19} width={6} height={6} fill={ink} />
      </g>
    ),
  },
};

/**
 * Fills its (positioned) parent with an adire pattern. `scale` makes the motif bigger or smaller.
 * Purely decorative: hidden from screen readers.
 */
export function AdireFill({ motif, bg, ink, scale = 1, className }: { motif: Motif; bg: string; ink: string; scale?: number; className?: string }) {
  const id = `adire-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const tile = TILES[motif];
  const s = tile.size;
  return (
    <svg aria-hidden className={className ?? "pointer-events-none absolute inset-0 h-full w-full"} style={{ ["--adire-bg" as string]: bg }}>
      <defs>
        <pattern id={id} width={s} height={s} patternUnits="userSpaceOnUse" patternTransform={scale === 1 ? undefined : `scale(${scale})`}>
          <rect width={s} height={s} fill={bg} />
          {tile.draw(ink)}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

export const MOTIFS = Object.keys(TILES) as Motif[];
