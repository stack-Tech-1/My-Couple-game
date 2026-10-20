import { cn } from "@/lib/cn";

/** Motifs drawn for Amah. Each is a single-line mark on a tinted disc. */
export const AVATAR_MOTIFS = {
  fig: "M12 6.4c-.2-1.2.4-2.2 1.6-2.6M12 6.6c3.4 0 5.6 3 5.6 6.6 0 3.6-2.6 6.2-5.6 6.2s-5.6-2.6-5.6-6.2c0-3.6 2.2-6.6 5.6-6.6Z",
  moon: "M16.8 15.4A6.4 6.4 0 0 1 9 6.6a6.4 6.4 0 1 0 7.8 8.8Z",
  wave: "M4 13.2c1.6-2.2 3.2-2.2 4.8 0s3.2 2.2 4.8 0 3.2-2.2 4.8 0M4 9.2c1.6-2.2 3.2-2.2 4.8 0s3.2 2.2 4.8 0 3.2-2.2 4.8 0",
  key: "M9 15.6a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8ZM12.2 12.2h7.4M17.4 12.2v2.6M15.2 12.2v1.8",
  pear: "M12 4.6v2.2M12 6.8c1.8 0 2.4 1.8 2.6 3.2.2 1.4 2.6 2.6 2.6 5.2 0 2.6-2.2 4.2-5.2 4.2s-5.2-1.6-5.2-4.2c0-2.6 2.4-3.8 2.6-5.2.2-1.4.8-3.2 2.6-3.2Z",
  knot: "M8 8c4 0 4 8 8 8M8 16c4 0 4-8 8-8M8 8a4 4 0 0 0 0 8M16 8a4 4 0 0 1 0 8",
  bloom: "M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0M12 10c-1.6-2.8-.6-5 0-5.4.6.4 1.6 2.6 0 5.4M14 12c2.8-1.6 5-.6 5.4 0-.4.6-2.6 1.6-5.4 0M12 14c1.6 2.8.6 5 0 5.4-.6-.4-1.6-2.6 0-5.4M10 12c-2.8 1.6-5 .6-5.4 0 .4-.6 2.6-1.6 5.4 0",
  comet: "M15.4 8.6a2.6 2.6 0 1 1-3.7 3.7 2.6 2.6 0 0 1 3.7-3.7ZM11.4 12.6 5 19M12.6 14.2 8.4 18.4M10 11.2 5.6 15.6",
} as const;

export type AvatarMotif = keyof typeof AVATAR_MOTIFS;
export const AVATAR_HUES = [12, 32, 352, 140, 200, 280, 48, 168] as const;

export function Avatar({
  name,
  motif = "fig",
  hue = 12,
  size = 44,
  online,
  className,
}: {
  name: string;
  motif?: string;
  hue?: number;
  size?: number;
  online?: boolean;
  className?: string;
}) {
  const path = AVATAR_MOTIFS[(motif in AVATAR_MOTIFS ? motif : "fig") as AvatarMotif];
  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={online === undefined ? name : `${name}, ${online ? "online" : "away"}`}
    >
      <span
        className="flex h-full w-full items-center justify-center rounded-full border-[1.5px]"
        style={{
          background: `hsl(${hue} 52% 86%)`,
          borderColor: `hsl(${hue} 40% 28%)`,
          color: `hsl(${hue} 45% 24%)`,
        }}
      >
        <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d={path} />
        </svg>
      </span>
      {online !== undefined ? (
        <span
          aria-hidden
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-2 border-bg transition-colors",
            online ? "bg-[#4f9a5b]" : "bg-[#a8999a]",
          )}
          style={{ width: Math.max(10, size * 0.26), height: Math.max(10, size * 0.26) }}
        />
      ) : null}
    </span>
  );
}