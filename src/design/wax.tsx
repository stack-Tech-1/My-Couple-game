import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Wax print: Amah's cloth. Big, bold, several colours at once, the way ankara is printed.
 * One print per page, at the top; everything else on the page is plain colour cut from it.
 * Colours come from the fabric tokens in globals.css, so night mode deepens every print at once.
 *
 * - record: the concentric-circle print. Home.
 * - palm: palm leaves. On your own.
 * - hibiscus: five-petal flowers. Head to head.
 * - wave: lagoon waves and sun dots. Same team.
 * - sun: marigold sunbursts. Getting to know you.
 * - cowrie: cowries on plum. Soft hours.
 * - comb: the stripe-and-comb print. Settings, quieter pages.
 */
export type Print = "record" | "palm" | "hibiscus" | "wave" | "sun" | "cowrie" | "comb";

const C = {
  calico: "var(--fab-calico)",
  indigo: "var(--fab-indigo)",
  hibiscus: "var(--fab-hibiscus)",
  marigold: "var(--fab-marigold)",
  palm: "var(--fab-palm)",
  plum: "var(--fab-plum)",
  lagoon: "var(--fab-lagoon)",
};

type Tile = { size: number; draw: ReactNode };

const corners = (s: number, r: number, fill: string) =>
  [0, s].flatMap((x) => [0, s].map((y) => <circle key={`${x}-${y}-${r}`} cx={x} cy={y} r={r} fill={fill} />));

const PRINTS: Record<Print, Tile> = {
  record: {
    size: 120,
    draw: (
      <>
        <rect width={120} height={120} fill={C.indigo} />
        <circle cx={60} cy={60} r={44} fill={C.marigold} />
        <circle cx={60} cy={60} r={34} fill={C.indigo} />
        <circle cx={60} cy={60} r={27} fill={C.calico} />
        <circle cx={60} cy={60} r={18} fill={C.hibiscus} />
        <circle cx={60} cy={60} r={7} fill={C.indigo} />
        {corners(120, 16, C.palm)}
        {corners(120, 7, C.calico)}
        <g fill={C.calico}>
          <circle cx={60} cy={6} r={3} />
          <circle cx={60} cy={114} r={3} />
          <circle cx={6} cy={60} r={3} />
          <circle cx={114} cy={60} r={3} />
        </g>
      </>
    ),
  },
  palm: {
    size: 96,
    draw: (
      <>
        <rect width={96} height={96} fill={C.palm} />
        <path d="M48 6C70 26 70 58 48 90C26 58 26 26 48 6Z" fill={C.marigold} />
        <path d="M48 14V84" stroke={C.palm} strokeWidth={4} />
        <path d="M48 30L36 22M48 44L33 35M48 58L35 50M48 30L60 22M48 44L63 35M48 58L61 50" stroke={C.palm} strokeWidth={3} strokeLinecap="round" />
        <circle cx={0} cy={48} r={14} fill={C.calico} />
        <circle cx={96} cy={48} r={14} fill={C.calico} />
        <circle cx={0} cy={48} r={6} fill={C.hibiscus} />
        <circle cx={96} cy={48} r={6} fill={C.hibiscus} />
      </>
    ),
  },
  hibiscus: {
    size: 100,
    draw: (
      <>
        <rect width={100} height={100} fill={C.hibiscus} />
        <g transform="translate(50 50)" fill={C.calico}>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} rx={10} ry={26} transform={`rotate(${a})`} />
          ))}
          <circle r={10} fill={C.marigold} />
          <circle r={4} fill={C.plum} />
        </g>
        {corners(100, 8, C.plum)}
      </>
    ),
  },
  wave: {
    size: 96,
    draw: (
      <>
        <rect width={96} height={96} fill={C.lagoon} />
        <path d="M0 30q24-22 48 0t48 0v14q-24-22-48 0t-48 0z" fill={C.calico} />
        <path d="M0 74q24-22 48 0t48 0v8q-24-22-48 0t-48 0z" fill={C.palm} />
        <circle cx={24} cy={56} r={6} fill={C.marigold} />
        <circle cx={72} cy={12} r={6} fill={C.marigold} />
      </>
    ),
  },
  sun: {
    size: 104,
    draw: (
      <>
        <rect width={104} height={104} fill={C.marigold} />
        <g transform="translate(52 52)">
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d="M-5 -26L0 -42L5 -26Z" fill={C.indigo} transform={`rotate(${i * 30})`} />
          ))}
          <circle r={22} fill={C.indigo} />
          <circle r={15} fill={C.calico} />
          <circle r={7} fill={C.hibiscus} />
        </g>
        {corners(104, 10, C.calico)}
        {corners(104, 4, C.indigo)}
      </>
    ),
  },
  cowrie: {
    size: 84,
    draw: (
      <>
        <rect width={84} height={84} fill={C.plum} />
        <g fill={C.calico}>
          <ellipse cx={21} cy={21} rx={11} ry={15} />
          <ellipse cx={63} cy={63} rx={11} ry={15} />
        </g>
        <g stroke={C.plum} strokeWidth={2.4} strokeDasharray="2.5 2.5">
          <path d="M21 9V33" />
          <path d="M63 51V75" />
        </g>
        <circle cx={63} cy={21} r={7} fill={C.marigold} />
        <circle cx={21} cy={63} r={7} fill={C.hibiscus} />
      </>
    ),
  },
  comb: {
    size: 80,
    draw: (
      <>
        <rect width={80} height={80} fill={C.indigo} />
        <rect y={0} width={80} height={14} fill={C.marigold} />
        <rect y={40} width={80} height={14} fill={C.marigold} />
        <g fill={C.calico}>
          {[4, 20, 36, 52, 68].map((x) => (
            <rect key={x} x={x} y={18} width={8} height={18} rx={4} />
          ))}
          {[12, 28, 44, 60, 76].map((x) => (
            <rect key={x} x={x - 4} y={58} width={8} height={18} rx={4} />
          ))}
        </g>
      </>
    ),
  },
};

/** Fills its (positioned) parent with a wax print. Purely decorative. */
export function WaxPrint({ print, scale = 1, className }: { print: Print; scale?: number; className?: string }) {
  const id = `wax-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const t = PRINTS[print];
  return (
    <svg aria-hidden className={className ?? "pointer-events-none absolute inset-0 h-full w-full"}>
      <defs>
        <pattern id={id} width={t.size} height={t.size} patternUnits="userSpaceOnUse" patternTransform={scale === 1 ? undefined : `scale(${scale})`}>
          {t.draw}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/**
 * The selvedge: real wax cloth carries the maker's name printed along its edge. Ours runs under
 * each page's print. Decorative, so screen readers skip it.
 */
export function Selvedge({ words, className }: { words: string[]; className?: string }) {
  const line = ["AMAH", ...words, "REAL WAX PRINT"].join(" · ");
  return (
    <div aria-hidden className={cn("selvedge", className)}>
      <span>{Array.from({ length: 6 }, () => line).join(" · ")}</span>
    </div>
  );
}

/** The print each part of the app wears, and the solid colour cut from it. */
export const SECTION_CLOTH = {
  "head-to-head": { print: "hibiscus", fill: "var(--fab-hibiscus)", deep: "var(--fab-hibiscus-deep)", ink: "#fff8f0" },
  competitive: { print: "hibiscus", fill: "var(--fab-hibiscus)", deep: "var(--fab-hibiscus-deep)", ink: "#fff8f0" },
  coop: { print: "wave", fill: "var(--fab-palm)", deep: "var(--fab-palm-deep)", ink: "#fff8f0" },
  personal: { print: "sun", fill: "var(--fab-marigold)", deep: "var(--fab-marigold-deep)", ink: "#1b1519" },
  romantic: { print: "cowrie", fill: "var(--fab-plum)", deep: "var(--fab-plum-deep)", ink: "#fff8f0" },
  solo: { print: "palm", fill: "var(--fab-lagoon)", deep: "var(--fab-lagoon-deep)", ink: "#fff8f0" },
  spicy: { print: "cowrie", fill: "#2a1216", deep: "#1b0b0e", ink: "#f4e4da" },
} as const satisfies Record<string, { print: Print; fill: string; deep: string; ink: string }>;
