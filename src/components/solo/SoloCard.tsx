import Link from "next/link";
import { AdireFill } from "@/design/adire";
import { cn } from "@/lib/cn";
import type { SoloGame } from "@/lib/solo/catalog";
import { SoloArt } from "./SoloArt";

/** A Solo game on the shelf: its pattern, its drawing, and your best on a frosted strip. */
export function SoloCard({ game, note, tag, size = "normal", href }: { game: SoloGame; note?: string; tag?: string; size?: "normal" | "peek" | "small"; href?: string }) {
  return (
    <Link
      prefetch={false}
      href={href ?? `/solo/${game.id}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[22px] shadow-[0_16px_30px_-22px_rgba(28,20,22,.7)] transition-transform duration-200 hover:-translate-y-0.5",
        size === "peek" ? "h-40 w-36 shrink-0" : size === "small" ? "h-32" : "h-44",
      )}
      style={{ color: "#1c1416" }}
    >
      <AdireFill motif={game.look.motif} bg={game.look.bg} ink={game.look.ink} />
      <div className={cn("relative flex flex-1 items-center justify-center", size === "small" ? "pb-12 pt-2" : "pb-14 pt-3")}>
        <SoloArt id={game.id} className={cn("w-auto transition-transform duration-300 group-hover:scale-[1.05]", size === "small" ? "h-12" : "h-16")} />
      </div>
      {tag ? <span className="absolute right-2.5 top-2.5 rounded-full bg-[#1c1416] px-2 py-0.5 text-[0.68rem] font-bold text-[#fbf7f1]">{tag}</span> : null}
      <div className="absolute inset-x-2 bottom-2 rounded-[15px] border border-white/75 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,.9)] backdrop-blur-xl" style={{ background: "rgba(255,250,244,.7)" }}>
        <p className="text-[0.9rem] font-bold leading-tight">{game.name}</p>
        <p className="mt-0.5 truncate text-[0.74rem] text-[#57474a]">{note ?? game.tagline}</p>
      </div>
    </Link>
  );
}
