"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { soloGame } from "@/lib/solo/catalog";
import { SoloShell } from "./SoloShell";

// Each game types its own saved state; the frame just stores it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- boundary between the shared frame and each game
type AnySaved = any;
import type { FixPicture } from "./games/FixAm";
import { Credit } from "./Credit";
import { MamaDayDone } from "./mama/MamaDayDone";
import { OkadaRouteDone } from "./okada/OkadaRouteDone";
import { ZoboLevelDone } from "./zobo/ZoboLevelDone";
import { rankFor, starsOfTakings } from "@/lib/solo/games/zobo";
import { BashWallDone } from "./bash/BashWallDone";
import { rankFor as bashRank, starsOfTakings as bashStars } from "@/lib/solo/games/bashwall";
import { MosquitoNightDone } from "./mosquito/MosquitoNightDone";
import { rankFor as mosquitoRank, starsOfTakings as mosquitoStars } from "@/lib/solo/games/mosquito";

// Each game is its own download, fetched only when you open it.
const loading = () => <p className="py-16 text-center text-muted">Setting up…</p>;
const BlendAm = dynamic(() => import("./games/BlendAm").then((m) => m.BlendAm), { ssr: false, loading });
const Ajo = dynamic(() => import("./games/Ajo").then((m) => m.Ajo), { ssr: false, loading });
const OkadaRush = dynamic(() => import("./games/OkadaRush").then((m) => m.OkadaRush), { ssr: false, loading });
const ReflexTraining = dynamic(() => import("./games/ReflexTraining").then((m) => m.ReflexTraining), { ssr: false, loading });
const PumpAm = dynamic(() => import("./games/PumpAm").then((m) => m.PumpAm), { ssr: false, loading });
const BashAm = dynamic(() => import("./games/BashAm").then((m) => m.BashAm), { ssr: false, loading });
const BashWall = dynamic(() => import("./games/BashWall").then((m) => m.BashWall), { ssr: false, loading });
const ZoboSort = dynamic(() => import("./games/ZoboSort").then((m) => m.ZoboSort), { ssr: false, loading });
const CatchAm = dynamic(() => import("./games/CatchAm").then((m) => m.CatchAm), { ssr: false, loading });
const MosquitoWahala = dynamic(() => import("./games/MosquitoWahala").then((m) => m.MosquitoWahala), { ssr: false, loading });
const MamaPut = dynamic(() => import("./games/MamaPut").then((m) => m.MamaPut), { ssr: false, loading });
const FixAm = dynamic(() => import("./games/FixAm").then((m) => m.FixAm), { ssr: false, loading });
/** Bots bring the full game boards, so they load only when a bot game is opened. */
export const BotScreen = dynamic(() => import("./BotScreen").then((m) => m.BotScreen), { ssr: false, loading });

type Common = { myName: string; soundOn: boolean; challenge: string | null; toured: boolean };

/** Blend Am, Ajo, Okada Rush and Reflex Training: one frame, one game. */
export function ArcadeScreen({
  gameId,
  daily = null,
  play = null,
  ...c
}: Common & {
  gameId: string;
  daily?: { mode: string; seed: string } | null;
  /** A chosen version (Mama Put's difficulty or career day, an Okada Rush route) and what it needs, such as upgrades. */
  play?: { mode: string; title: string; tagline: string; owned?: readonly string[]; tutorial?: boolean; careerDay?: number; route?: number; skin?: string; savings?: number; zobo?: { level: number; totalStars: number; levelStars: number }; mosquito?: { night: number; totalStars: number; nightStars: number }; bash?: { wall: number; totalStars: number; wallStars: number } } | null;
}) {
  const game = soloGame(gameId)!;
  const careerDay = play?.careerDay;
  const route = play?.route;
  const zobo = play?.zobo;
  // The stars this level adds to the career, for the rank on the finish screen and the poster.
  const zoboTotal = (score: number) => (zobo ? zobo.totalStars + Math.max(0, starsOfTakings(zobo.level, score) - zobo.levelStars) : 0);
  const mosquito = play?.mosquito;
  const mosquitoTotal = (score: number) => (mosquito ? mosquito.totalStars + Math.max(0, mosquitoStars(mosquito.night, score) - mosquito.nightStars) : 0);
  const bash = play?.bash;
  const bashTotal = (score: number) => (bash ? bash.totalStars + Math.max(0, bashStars(bash.wall, score) - bash.wallStars) : 0);
  return (
    <SoloShell<AnySaved>
      gameId={gameId}
      myName={c.myName}
      soundOn={c.soundOn}
      challenge={c.challenge}
      toured={c.toured}
      {...(daily ? { mode: daily.mode, seed: daily.seed, backHref: "/room" } : {})}
      {...(play ? { mode: play.mode, backHref: `/solo/${gameId}`, extras: { owned: play.owned ?? [], tutorial: play.tutorial, skin: play.skin, savings: play.savings } } : {})}
      {...(gameId === "zobo-sort" ? { outNote: "That's today's free level of Zobo Sort" } : {})}
      {...(zobo
        ? {
            posterHeadline: (score: number) => `${rankFor(zoboTotal(score)).name}, level ${zobo.level}`,
            doneView: (r: { score: number; newBest: boolean; left: number | null; again: () => void; share: () => void }) => <ZoboLevelDone level={zobo.level} score={r.score} totalBefore={zobo.totalStars} totalAfter={zoboTotal(r.score)} left={r.left} again={r.again} share={r.share} />,
          }
        : {})}
      {...(bash
        ? {
            posterHeadline: (score: number) => `${bashRank(bashTotal(score)).name}, wall ${bash.wall}`,
            posterScore: (score: number) => `₦${score.toLocaleString("en-NG")}`,
            doneView: (r: { score: number; again: () => void; share: () => void }) => <BashWallDone wall={bash.wall} score={r.score} totalBefore={bash.totalStars} totalAfter={bashTotal(r.score)} again={r.again} share={r.share} />,
          }
        : {})}
      {...(mosquito
        ? {
            posterHeadline: (score: number) => `${mosquitoRank(mosquitoTotal(score)).name}, night ${mosquito.night}`,
            posterScore: (score: number) => `₦${score.toLocaleString("en-NG")}`,
            doneView: (r: { score: number; left: number | null; again: () => void; share: () => void }) => <MosquitoNightDone night={mosquito.night} score={r.score} totalBefore={mosquito.totalStars} totalAfter={mosquitoTotal(r.score)} left={r.left} again={r.again} share={r.share} />,
          }
        : {})}
      {...(careerDay ? { doneView: (r: { score: number; newBest: boolean; again: () => void; share: () => void }) => <MamaDayDone day={careerDay} score={r.score} newBest={r.newBest} again={r.again} share={r.share} /> } : {})}
      {...(route ? { doneView: (r: { score: number; newBest: boolean; again: () => void; share: () => void }) => <OkadaRouteDone route={route} score={r.score} newBest={r.newBest} again={r.again} share={r.share} /> } : {})}
      header={<Title name={daily ? `Today's game: ${game.name}` : (play?.title ?? game.name)} tagline={daily ? "The same level for everyone today. You get one go." : (play?.tagline ?? game.tagline)} />}
    >
      {(api) =>
        gameId === "blend-am" ? (
          <BlendAm api={api} />
        ) : gameId === "ajo" ? (
          <Ajo api={api} />
        ) : gameId === "okada-rush" ? (
          <OkadaRush api={api} />
        ) : gameId === "pump-am" ? (
          <PumpAm api={api} />
        ) : gameId === "bash-am" ? (
          bash ? <BashWall api={api} /> : <BashAm api={api} />
        ) : gameId === "zobo-sort" ? (
          <ZoboSort api={api} />
        ) : gameId === "catch-am" ? (
          <CatchAm api={api} />
        ) : gameId === "mosquito-wahala" ? (
          <MosquitoWahala api={api} />
        ) : gameId === "mama-put" ? (
          <MamaPut api={api} />
        ) : (
          <ReflexTraining api={api} />
        )
      }
    </SoloShell>
  );
}

function Title({ name, tagline }: { name: string; tagline: string }) {
  return (
    <div className="mt-5">
      <h1 className="display text-[2.2rem] leading-none">{name}</h1>
      <p className="mt-1.5 text-muted">{tagline}</p>
    </div>
  );
}

const SIZES = [3, 4, 5] as const;
export const fixMode = (n: number, pictureId: string) => `${n}-${pictureId.replace(/-/g, "").slice(0, 8)}`;

/** Fix Am: today's picture (or one from your collection), at the size you pick. */
export function FixAmScreen({ pictures, todayId, finished, total, ...c }: Common & { pictures: FixPicture[]; todayId: string | null; finished: string[]; total: number }) {
  const [pic, setPic] = useState<string | null>(todayId);
  const [n, setN] = useState<number>(3);
  const [playing, setPlaying] = useState(!!c.challenge);
  const picture = pictures.find((p) => p.id === pic) ?? pictures[0];

  if (!picture) return <p className="glass mt-8 rounded-[22px] p-6 text-center text-muted">The first pictures are on their way. Check back soon.</p>;

  if (playing)
    return (
      <SoloShell<AnySaved>
        key={`${picture.id}-${n}`}
        gameId="fix-am"
        mode={fixMode(n, picture.id)}
        seed={picture.id}
        myName={c.myName}
        soundOn={c.soundOn}
        challenge={c.challenge}
        toured={c.toured}
        poster={{ photoUrl: picture.url, credit: picture.credit }}
        header={<Title name={picture.name} tagline={`${picture.place}${picture.note ? `. ${picture.note}` : ""}`} />}
      >
        {(api) => <FixAm api={api} picture={picture} n={n} />}
      </SoloShell>
    );

  const mine = new Set(finished);
  // Unlocked ones first, then just a few locked spaces, so 50 pictures isn't a wall of question marks.
  const open = pictures.filter((p) => mine.has(p.id) || p.id === todayId);
  const locked = pictures.filter((p) => !mine.has(p.id) && p.id !== todayId);
  const LOCKED_SHOWN = 6;
  const shown = [...open, ...locked.slice(0, LOCKED_SHOWN)];
  return (
    <div>
      <Title name="Fix Am" tagline="Slide the tiles back into place. Every picture is somewhere in Naija." />
      <div className="glass mt-5 overflow-hidden rounded-[24px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo from storage */}
        <img src={picture.url} alt="" className="h-56 w-full object-cover" />
        <div className="p-4">
          <p className="text-[0.8rem] font-bold text-[#82601f]">{picture.id === todayId ? "Today's picture" : "From your collection"}</p>
          <p className="display text-[1.5rem] leading-tight">{picture.name}</p>
          <p className="text-[0.85rem] text-muted">{picture.place}</p>
          {picture.credit ? <Credit picture={picture} className="mt-1" /> : null}
          {picture.link ? (
            <a href={picture.link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[0.8rem] font-semibold underline underline-offset-2">
              See the real place
            </a>
          ) : null}
          <div role="radiogroup" aria-label="Size" className="mt-4 grid grid-cols-3 gap-2">
            {SIZES.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={n === s} onClick={() => setN(s)} className={cn("rounded-[14px] border-[1.5px] py-2.5 font-bold", n === s ? "border-[#1c1416] bg-raised" : "border-line")}>
                {s}×{s}
                <span className="block text-[0.72rem] font-semibold text-muted">{s === 3 ? "Easy" : s === 4 ? "Medium" : "Hard"}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setPlaying(true)} className="mt-4 h-12 w-full rounded-full bg-[#1c1416] font-extrabold text-[#f6efe6]">
            Start
          </button>
        </div>
      </div>

      <section aria-labelledby="coll-h" className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 id="coll-h" className="display text-[1.4rem]">Your collection</h2>
          <span className="text-[0.85rem] font-semibold text-muted">
            {mine.size} of {total}
          </span>
        </div>
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {shown.map((p) => {
            const have = mine.has(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => (have || p.id === todayId) && setPic(p.id)}
                  disabled={!have && p.id !== todayId}
                  aria-label={have || p.id === todayId ? `${p.name}${have ? ", finished" : ", today's picture"}` : "Not unlocked yet"}
                  className={cn("relative block h-24 w-full overflow-hidden rounded-[14px]", pic === p.id && "outline outline-[3px] outline-[#1c1416]")}
                >
                  {have || p.id === todayId ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo from storage */}
                      <img src={p.url} alt="" className="h-full w-full object-cover" />
                      <span className="absolute inset-x-1 bottom-1 truncate rounded-[6px] bg-[rgba(255,250,244,.85)] px-1.5 py-0.5 text-left text-[0.68rem] font-bold">{p.name}</span>
                    </>
                  ) : (
                    <span className="flex h-full items-center justify-center bg-[repeating-linear-gradient(45deg,#e6d9c8_0_8px,#ddcdb8_8px_16px)] font-display text-[1.4rem] text-[#82601f]">?</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {locked.length > LOCKED_SHOWN ? <p className="mt-2 text-center text-[0.85rem] font-semibold">{locked.length - LOCKED_SHOWN} more to find</p> : null}
        <p className="mt-2 text-[0.8rem] text-muted">A new picture every day. Finish one and it joins your collection to play again any time.</p>
      </section>
    </div>
  );
}
