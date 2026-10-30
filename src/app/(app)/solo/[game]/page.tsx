import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/design/icons";
import { PageBackdrop } from "@/components/room/HomeBackdrop";
import { ArcadeScreen, BotScreen, FixAmScreen } from "@/components/solo/SoloScreens";
import { Oro } from "@/components/solo/games/Oro";
import { getGameFlags } from "@/lib/games/flags.server";
import { lagosDay, soloGame } from "@/lib/solo/catalog";
import { soloContext } from "@/lib/solo/context";
import { getOro } from "@/lib/solo/oro";
import { fixamToday } from "@/lib/solo/fixam-server";
import { SoloBoards } from "@/components/solo/SoloBoards";

export async function generateMetadata({ params }: { params: Promise<{ game: string }> }): Promise<Metadata> {
  const { game } = await params;
  return { title: soloGame(game)?.name ?? "Solo" };
}

export default async function SoloGamePage({ params, searchParams }: { params: Promise<{ game: string }>; searchParams: Promise<{ challenge?: string }> }) {
  const { game: id } = await params;
  const { challenge } = await searchParams;
  const game = soloGame(id);
  if (!game) notFound();
  const ctx = await soloContext();
  const backdrop = <PageBackdrop motif={game.look.motif} bg={game.look.bg} ink={game.look.ink} glow="rgba(232,86,58,.3)" height={300} />;

  if ((await getGameFlags()).off.includes(game.id)) {
    return (
      <div className="pt-16 text-center">
        <h1 className="display text-[2.2rem]">{game.name} is taking a break.</h1>
        <p className="mt-2 text-muted">Everything else in Solo is open.</p>
        <Link prefetch={false} href="/solo" className="mt-6 inline-flex items-center gap-1.5 font-semibold underline">
          <Icon name="arrowLeft" size={16} /> Solo
        </Link>
      </div>
    );
  }

  const common = { myName: ctx.profile.display_name, soundOn: ctx.soundOn, challenge: challenge && /^[A-Za-z0-9_-]{10,40}$/.test(challenge) ? challenge : null };
  let body: React.ReactNode;
  if (game.id === "oro") {
    const r = await getOro();
    body = r.ok ? <Oro initial={r.data} myName={ctx.profile.display_name} soundOn={ctx.soundOn} /> : <p className="text-muted">{r.error}</p>;
  } else if (game.id === "fix-am") {
    body = <FixAmScreen {...common} {...await fixamToday(ctx.user.id, lagosDay())} />;
  } else if (game.kind === "bot") {
    body = <BotScreen gameId={game.id} base={game.base!} myName={ctx.profile.display_name} soundOn={ctx.soundOn} />;
  } else {
    body = (
      <>
        <ArcadeScreen gameId={game.id} {...common} />
        <SoloBoards gameId={game.id} rooms={ctx.rooms} me={ctx.user.id} />
      </>
    );
  }

  return (
    <div className="relative isolate pt-6">
      {backdrop}
      {body}
    </div>
  );
}
