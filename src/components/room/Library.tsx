"use client";

import Link from "next/link";
import { Icon } from "@/design/icons";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { CATEGORIES, CATEGORY_ORDER, gamesIn, isFriendGame, type GameMeta } from "@/games/catalog";
import { GameArt } from "@/games/GameArt";
import { cn } from "@/lib/cn";
import { afterDarkOpen } from "@/lib/room/afterDark";
import { useGameFlags } from "@/lib/games/FlagsProvider";

export function Library() {
  const { bundle } = useRoom();
  const spicyOpen = afterDarkOpen(bundle);
  const { isOff, isNew } = useGameFlags();
  const friendsRoom = bundle.room.kind === "friends";

  return (
    <section aria-labelledby="library-h">
      <h2 id="library-h" className="eyebrow border-t-[1.5px] border-line-strong pt-5 text-muted">The library</h2>
      <div className="mt-6 space-y-14">
        {CATEGORY_ORDER.map((c) => {
          const cat = CATEGORIES[c];
          const games = gamesIn(c).filter((g) => !isOff(g.id) && (!friendsRoom || isFriendGame(g.id)));
          // Friend rooms never mention After Dark.
          if (friendsRoom && c === "spicy") return null;
          // Discretion: After Dark is one panel on the shared home screen, never a list of its games.
          if (!games.length && c !== "spicy") return null;
          if (c === "spicy") return <AfterDarkEntry key={c} roomId={bundle.room.id} open={spicyOpen} />;
          return (
            <div key={c}>
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="display text-[2rem]" style={{ color: cat.ink }}>{cat.label}</h3>
                <span className="text-[0.85rem] text-muted tabular">{games.length} games</span>
              </div>
              <p className="mt-1 text-muted">{friendsRoom && c === "competitive" ? "Loser buys the next round of suya." : cat.blurb}</p>
              <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {games.map((g, i) => (
                  <li key={g.id} className={cn(i === 0 && "col-span-2 sm:col-span-1 sm:row-span-2")}>
                    <Tile game={g} roomId={bundle.room.id} accent={cat.color} large={i === 0} fresh={isNew(g.id)} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Tile({ game, roomId, accent, large, fresh }: { game: GameMeta; roomId: string; accent: string; large: boolean; fresh: boolean }) {
  return (
    <Link
      href={`/room/${roomId}/games/${game.id}`}
      className="group relative flex h-full flex-col rounded-[16px] border border-line bg-raised p-4 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong"
    >
      {fresh ? <span className="absolute right-3 top-3 rounded-full bg-accent px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide text-on-accent">New</span> : null}
      <div className={cn("text-fg", large ? "py-4" : "py-1")}>
        <GameArt id={game.id} accent={accent} className={cn("mx-auto w-auto transition-transform duration-300 group-hover:scale-[1.04]", large ? "h-32" : "h-20")} />
      </div>
      <div className="mt-auto pt-2">
        <p className={cn("font-bold leading-tight", large && "display text-[1.6rem] font-normal")}>{game.name}</p>
        {large ? <p className="mt-1 text-[0.88rem] text-muted">{game.tagline}</p> : null}
        <p className="mt-1 flex items-center gap-1 text-[0.78rem] text-muted"><Icon name="clock" size={12} /> {game.estimatedMinutes} min</p>
      </div>
    </Link>
  );
}

function AfterDarkEntry({ roomId, open }: { roomId: string; open: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-[22px] bg-[#120c0e] p-7 text-[#f4e4da]">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 80% at 100% 0%, rgba(232,86,58,.3), transparent 70%)" }} />
      <div className="relative">
        <Icon name={open ? "flame" : "lock"} size={26} className="text-[#ff8a6e]" />
        <h3 className="display mt-4 text-[2rem]">{open ? "After dark." : "After dark is locked."}</h3>
        <p className="mt-2 max-w-md text-[#c9b0a7]">
          {open
            ? "Behind your PIN. Lights down, phones close."
            : "Five 18+ games for the two of you. It opens only when you’ve both confirmed your age and both said yes. Either of you can close it again anytime."}
        </p>
        <Link href={`/room/${roomId}/after-dark`} className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border-[1.5px] border-[#f4e4da] px-5 text-[0.95rem] font-semibold hover:bg-[#f4e4da] hover:text-[#120c0e]">
          {open ? "Go in" : "See how it works"} <Icon name="arrowRight" size={18} />
        </Link>
      </div>
    </div>
  );
}