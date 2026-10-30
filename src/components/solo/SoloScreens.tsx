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

// Each game is its own download, fetched only when you open it.
const loading = () => <p className="py-16 text-center text-muted">Setting up…</p>;
const BlendAm = dynamic(() => import("./games/BlendAm").then((m) => m.BlendAm), { ssr: false, loading });
const Ajo = dynamic(() => import("./games/Ajo").then((m) => m.Ajo), { ssr: false, loading });
const OkadaRush = dynamic(() => import("./games/OkadaRush").then((m) => m.OkadaRush), { ssr: false, loading });
const ReflexTraining = dynamic(() => import("./games/ReflexTraining").then((m) => m.ReflexTraining), { ssr: false, loading });
const FixAm = dynamic(() => import("./games/FixAm").then((m) => m.FixAm), { ssr: false, loading });
/** Bots bring the full game boards, so they load only when a bot game is opened. */
export const BotScreen = dynamic(() => import("./BotScreen").then((m) => m.BotScreen), { ssr: false, loading });

type Common = { myName: string; soundOn: boolean; challenge: string | null; toured: boolean };

/** Blend Am, Ajo, Okada Rush and Reflex Training: one frame, one game. */
export function ArcadeScreen({ gameId, ...c }: Common & { gameId: string }) {
  const game = soloGame(gameId)!;
  return (
    <SoloShell<AnySaved> gameId={gameId} myName={c.myName} soundOn={c.soundOn} challenge={c.challenge} toured={c.toured} header={<Title name={game.name} tagline={game.tagline} />}>
      {(api) =>
        gameId === "blend-am" ? (
          <BlendAm api={api} />
        ) : gameId === "ajo" ? (
          <Ajo api={api} />
        ) : gameId === "okada-rush" ? (
          <OkadaRush api={api} />
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
