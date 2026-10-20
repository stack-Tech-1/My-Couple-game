import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CATEGORIES, gameMeta } from "@/games/catalog";
import { GameArt } from "@/games/GameArt";
import { Icon } from "@/design/icons";
import { getMyRoom } from "@/lib/room/server";
import { afterDarkOpen } from "@/lib/room/afterDark";
import { GAME_LOGIC } from "@/games/logic";
import { activeSessions } from "@/lib/games/server";
import { Rules } from "@/components/game/Rules";
import { StartGame } from "@/components/game/StartGame";
import { FeaturePage, FEATURES } from "@/components/romantic/FeaturePage";
import { AfterDarkShell } from "@/components/afterdark/AfterDarkShell";
import { FantasyMatch } from "@/components/afterdark/FantasyMatch";
import { getAfterDark, getFantasy } from "@/lib/afterdark/server";

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
  if (FEATURES.has(game.id)) return <FeaturePage gameId={game.id} roomId={roomId} bundle={bundle} />;
  if (game.category === "spicy") {
    const ad = await getAfterDark(bundle);
    const logicFor = GAME_LOGIC[game.id];
    const activeSpicy = logicFor ? (await activeSessions(roomId)).find((s) => s.game_id === game.id) : undefined;
    return (
      <AfterDarkShell hasPin={ad.me.hasPin}>
        <div className="@container mx-auto max-w-3xl pt-8">
          <Link href={`/room/${roomId}/after-dark`} className="inline-flex items-center gap-1.5 text-[0.9rem] font-semibold text-muted hover:text-fg">
            <Icon name="arrowLeft" size={16} /> After dark
          </Link>
          <h1 className="display mt-6 text-[clamp(2.4rem,8vw,3.6rem)]">{game.name}</h1>
          <p className="mt-2 text-[1.05rem] text-muted">{game.tagline}</p>
          <div className="mt-8">
            {game.id === "fantasy-match" ? (
              <FantasyMatch initial={await getFantasy(roomId, bundle.me.profile.id)} />
            ) : logicFor ? (
              <>
                <StartGame gameId={game.id} activeSessionId={activeSpicy?.id ?? null} />
                <section aria-labelledby="rules-h" className="mt-12 border-t-[1.5px] border-line-strong pt-5">
                  <h2 id="rules-h" className="eyebrow mb-6 text-muted">How to play</h2>
                  <Rules rules={logicFor.rules} />
                </section>
              </>
            ) : null}
          </div>
        </div>
      </AfterDarkShell>
    );
  }
  const logic = GAME_LOGIC[game.id];
  const active = logic ? (await activeSessions(roomId)).find((s) => s.game_id === game.id) : undefined;

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
          {logic ? (
            <StartGame gameId={game.id} activeSessionId={active?.id ?? null} />
          ) : (
            <p className="mt-8 max-w-md rounded-[14px] border border-dashed border-line-strong p-5 leading-relaxed">
              <b>On the workbench.</b> This one&apos;s being built and tested in two windows side by side before it gets a Play button. It&apos;ll show up here as soon as it&apos;s ready.
            </p>
          )}
        </div>
        <div className="text-fg">
          <GameArt id={game.id} accent={cat.color} className="mx-auto h-auto w-full max-w-sm" />
        </div>
      </div>
      {logic ? (
        <section aria-labelledby="rules-h" className="mt-16 max-w-3xl border-t-[1.5px] border-line-strong pt-5">
          <h2 id="rules-h" className="eyebrow mb-6 text-muted">How to play</h2>
          <Rules rules={logic.rules} />
        </section>
      ) : null}
    </div>
  );
}