import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
import { todaysGame } from "@/lib/engage/rotation";
import { MamaHome } from "@/components/solo/mama/MamaHome";
import { mamaCareer } from "@/lib/solo/mama-server";
import { OkadaHome } from "@/components/solo/okada/OkadaHome";
import { okadaCareer } from "@/lib/solo/okada-server";
import { ROUTES, ROUTE_ABOUT, isSkin, routeOpen } from "@/lib/solo/games/okada";
import { ZoboHome } from "@/components/solo/zobo/ZoboHome";
import { zoboCareer } from "@/lib/solo/zobo-server";
import { STALLS, levelOfMode, levelOpen, stallOf } from "@/lib/solo/games/zobo";
import { AREAS, DAYS, DIFFICULTIES, DIFFICULTY_NAME, ITEM_NAME, areaIndex, dayOpen, newOnDay, type Difficulty } from "@/lib/solo/games/mama";

export async function generateMetadata({ params }: { params: Promise<{ game: string }> }): Promise<Metadata> {
  const { game } = await params;
  return { title: soloGame(game)?.name ?? "Solo" };
}

export default async function SoloGamePage({ params, searchParams }: { params: Promise<{ game: string }>; searchParams: Promise<{ challenge?: string; daily?: string; mode?: string; skin?: string }> }) {
  const { game: id } = await params;
  const { challenge, daily: dailyParam, mode: modeParam, skin } = await searchParams;
  // Today's game: the same level for everyone, from the Today card.
  const t = todaysGame();
  const daily = dailyParam === "1" && t.gameId === id ? { mode: t.mode, seed: t.seed } : null;
  const game = soloGame(id);
  if (!game) notFound();
  const ctx = await soloContext();
  const backdrop = <PageBackdrop motif={game.look.motif} bg={game.look.bg} ink={game.look.ink} glow="rgba(232,86,58,.3)" height={120} />;

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

  const toured = (ctx.profile.toured_games ?? []).includes(game.id);
  const common = { myName: ctx.profile.display_name, soundOn: ctx.soundOn, toured, challenge: challenge && /^[A-Za-z0-9_-]{10,40}$/.test(challenge) ? challenge : null };
  let body: React.ReactNode;
  if (game.id === "oro") {
    const r = await getOro();
    body = r.ok ? <Oro initial={r.data} myName={ctx.profile.display_name} soundOn={ctx.soundOn} toured={toured} /> : <p className="text-muted">{r.error}</p>;
  } else if (game.id === "fix-am") {
    body = <FixAmScreen {...common} {...await fixamToday(ctx.user.id, lagosDay())} />;
  } else if (game.id === "mama-put" && !daily && !common.challenge) {
    body = await mamaPutBody(ctx.user.id, modeParam, common, ctx.rooms);
  } else if (game.id === "okada-rush" && !daily && !common.challenge) {
    body = await okadaBody(ctx.user.id, modeParam, skin, common, ctx.rooms);
  } else if (game.id === "zobo-sort" && !common.challenge) {
    body = await zoboBody(ctx.user.id, modeParam, common);
  } else if (game.kind === "bot") {
    body = <BotScreen gameId={game.id} base={game.base!} myName={ctx.profile.display_name} soundOn={ctx.soundOn} toured={toured} />;
  } else {
    body = (
      <>
        <ArcadeScreen gameId={game.id} {...common} daily={daily} />
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

/** Mama Put: the career map and shop, or a chosen day or difficulty. */
async function mamaPutBody(userId: string, mode: string | undefined, common: { myName: string; soundOn: boolean; toured: boolean; challenge: string | null }, rooms: Parameters<typeof SoloBoards>[0]["rooms"]) {
  const career = await mamaCareer(userId);
  const day = mode ? /^day-(\d{1,2})$/.exec(mode) : null;
  if (day) {
    const d = Number(day[1]);
    if (d < 1 || d > DAYS || !dayOpen(d, (n) => career.dayBest[n - 1] ?? undefined)) redirect("/solo/mama-put");
    const area = areaIndex(d);
    const dishes = newOnDay(d);
    return (
      <ArcadeScreen
        gameId="mama-put"
        {...common}
        play={{
          mode: `day-${d}`,
          careerDay: d,
          owned: career.owned[area] ?? [],
          // A first-ever go at day 1 starts with the tutorial.
          tutorial: d === 1 && career.dayBest[0] == null,
          title: `Day ${d} · ${AREAS[area]}`,
          tagline: dishes.length ? `New on the menu today: ${dishes.map((x) => ITEM_NAME[x]).join(", ")}.` : "Serve every plate before they get vexed.",
        }}
      />
    );
  }
  if (mode && (DIFFICULTIES as readonly string[]).includes(mode)) {
    const k = mode as Difficulty;
    return (
      <>
        <ArcadeScreen gameId="mama-put" {...common} play={{ mode: k, title: `Mama Put · ${DIFFICULTY_NAME[k]}`, tagline: "90 seconds, the full menu, a standard buka." }} />
        <SoloBoards gameId="mama-put" rooms={rooms} me={userId} mode={k} />
      </>
    );
  }
  return (
    <>
      <MamaHome career={career} />
      <SoloBoards gameId="mama-put" rooms={rooms} me={userId} />
    </>
  );
}

/** Zobo Sort: the five stalls and the shop, or a chosen level. */
async function zoboBody(userId: string, mode: string | undefined, common: { myName: string; soundOn: boolean; toured: boolean; challenge: string | null }) {
  const career = await zoboCareer(userId);
  const level = mode ? levelOfMode(mode) : null;
  if (!level) return <ZoboHome career={career} />;
  if (!levelOpen(level, (n) => career.levelStars[n - 1]! > 0)) redirect("/solo/zobo-sort");
  const stall = STALLS[stallOf(level)]!;
  return (
    <ArcadeScreen
      gameId="zobo-sort"
      {...common}
      play={{ mode: `lvl-${level}`, owned: career.looks, savings: career.savings, zobo: { level, totalStars: career.totalStars, levelStars: career.levelStars[level - 1]! }, title: `Level ${level}`, tagline: `${stall.name}. ${stall.about}` }}
    />
  );
}

/** Okada Rush: the routes and garage, or a route, or Free Ride. */
async function okadaBody(userId: string, mode: string | undefined, skinParam: string | undefined, common: { myName: string; soundOn: boolean; toured: boolean; challenge: string | null }, rooms: Parameters<typeof SoloBoards>[0]["rooms"]) {
  const career = await okadaCareer(userId);
  // The colour picked on the home screen, if it's really yours.
  const skin = skinParam && isSkin(skinParam) && career.skins.includes(skinParam) ? skinParam : career.skin;
  const route = mode ? /^route-([1-5])$/.exec(mode) : null;
  if (route) {
    const n = Number(route[1]);
    if (!routeOpen(n, (k) => career.routeBest[k - 1] ?? undefined)) redirect("/solo/okada-rush");
    return <ArcadeScreen gameId="okada-rush" {...common} play={{ mode: `route-${n}`, route: n, owned: career.gear, skin, title: ROUTES[n - 1]!, tagline: ROUTE_ABOUT[n - 1]! }} />;
  }
  if (mode === "free") {
    return (
      <>
        <ArcadeScreen gameId="okada-rush" {...common} play={{ mode: "free", skin, title: "Okada Rush · Free Ride", tagline: "No end, busier and busier. How far can you go?" }} />
        <SoloBoards gameId="okada-rush" rooms={rooms} me={userId} mode="free" />
      </>
    );
  }
  return (
    <>
      <OkadaHome career={career} />
      <SoloBoards gameId="okada-rush" rooms={rooms} me={userId} mode="free" />
    </>
  );
}
