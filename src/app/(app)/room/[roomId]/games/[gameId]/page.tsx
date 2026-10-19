import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CATEGORIES, gameMeta } from "@/games/catalog";
import { GameArt } from "@/games/GameArt";
import { Icon } from "@/design/icons";
import { getMyRoom } from "@/lib/room/server";
import { afterDarkOpen } from "@/lib/room/afterDark";

export async function generateMetadata({ params }: { params: Promise<{ gameId: string }> }): Promise<Metadata> {
  const { gameId } = await params;
  return { title: gameMeta(gameId)?.name ?? "Game" };
}

export default async function GamePage({ params }: { params: Promise<{ roomId: string; gameId: string }> }) {
  const { roomId, gameId } = await params;
  const game = gameMeta(gameId);
  if (!game) notFound();
  const bundle = await getMyRoom();
  if (!bundle) redirect("/room");
  if (game.category === "spicy" && !afterDarkOpen(bundle)) redirect(`/room/${roomId}`);
  const cat = CATEGORIES[game.category];

  return (
    <div className="pt-8">
      <Link href={`/room/${roomId}`} className="inline-flex items-center gap-1.5 text-[0.9rem] font-semibold text-muted hover:text-fg">
        <Icon name="arrowLeft" size={16} /> Library
      </Link>
      <div className="mt-8 grid items-center gap-10 md:grid-cols-[1fr_1fr]">
        <div>
          <p className="eyebrow" style={{ color: cat.ink }}>{cat.label}</p>
          <h1 className="display mt-3 text-[clamp(2.8rem,9vw,5rem)]">{game.name}</h1>
          <p className="mt-4 text-[1.1rem] text-muted">{game.tagline}</p>
          <p className="mt-8 max-w-md rounded-[14px] border border-dashed border-line-strong p-5 leading-relaxed">
            <b>On the workbench.</b> This one&apos;s being built and tested in two windows side by side before it gets a Play button. It&apos;ll show up here as soon as it&apos;s ready.
          </p>
        </div>
        <div className="text-fg">
          <GameArt id={game.id} accent={cat.color} className="mx-auto h-auto w-full max-w-sm" />
        </div>
      </div>
    </div>
  );
}