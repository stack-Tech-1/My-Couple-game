"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/design/Avatar";
import { Modal } from "@/design/Modal";
import { toast } from "@/design/toast";
import { sendSpotlightLove } from "@/lib/engage/actions";
import { winnerName, type SpotlightWinner } from "@/lib/engage/spotlight-shared";
import { PosterStudio } from "@/components/poster/PosterStudio";
import type { PosterData } from "@/lib/poster/styles";

const GOLD = "linear-gradient(100deg,#9a6b1f,#f9e08a 30%,#c9952e 55%,#fff1b8 72%,#a8761f)";

function posterFor(w: SpotlightWinner): PosterData {
  const s = w.stats;
  return {
    people: w.kind === "couple" ? (w.people ?? []).map((p) => ({ name: p.name, motif: p.motif ?? "fig", hue: p.hue ?? 12 })) : [{ name: w.room_name ?? "Our room", motif: "knot", hue: 140 }],
    level: null,
    headline: w.kind === "couple" ? "Couple of the Week" : "Gang of the Week",
    stats: w.kind === "couple"
      ? [{ value: `${s.days ?? 0} of 7`, label: "days together" }, { value: String(s.games ?? 0), label: "games this week" }, { value: w.grade, label: "this week's grade" }]
      : [{ value: String(s.games ?? 0), label: "games this week" }, { value: `${s.active ?? 0} of ${s.members ?? 0}`, label: "of us playing" }, { value: w.grade, label: "this week's grade" }],
    rivalry: null,
    game: null,
    year: new Date().getFullYear(),
    photo: null,
    seed: `${w.id}`,
  };
}

/** The winners, gold on emerald, with a heart for everyone to send and a poster for the winners. */
export function SpotlightCards({ winners }: { winners: SpotlightWinner[] }) {
  return (
    <div className="mt-2 flex flex-col gap-10">
      <style>{`@font-face{font-family:"Amah Script";src:url(/fonts/poster/pinyon-script.woff2) format("woff2");font-display:swap}`}</style>
      {winners.map((w) => (
        <Winner key={w.id} w={w} />
      ))}
    </div>
  );
}

function Winner({ w }: { w: SpotlightWinner }) {
  const [love, setLove] = useState(w.love);
  const [loved, setLoved] = useState(w.loved);
  const [poster, setPoster] = useState(false);
  const [pending, start] = useTransition();
  const couple = w.kind === "couple";
  const s = w.stats;
  const name = winnerName(w);

  const send = () =>
    start(async () => {
      const r = await sendSpotlightLove(w.id);
      if (!r.ok) return void toast.error(r.error);
      setLove(r.data.love);
      setLoved(true);
    });

  return (
    <section aria-labelledby={`win-${w.id}`} className="text-center">
      <h1 className="text-[3.2rem] leading-none" style={{ background: GOLD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", fontFamily: "'Amah Script', cursive" }}>
        {couple ? "Couple of the Week" : "Gang of the Week"}
      </h1>
      <div className="mx-auto mt-6 flex h-44 w-44 items-center justify-center rounded-full p-1.5" style={{ background: GOLD }}>
        <div className="flex h-full w-full items-center justify-center rounded-full bg-[#0d3b2e]">
          {couple ? (
            <div className="flex -space-x-3">
              {(w.people ?? []).map((p) => (
                <Avatar key={p.name} name={p.name} motif={p.motif ?? "fig"} hue={p.hue ?? 12} size={72} className="rounded-full ring-4 ring-[#0d3b2e]" />
              ))}
            </div>
          ) : (
            <span className="display text-[3rem] text-[#fff6dc]">{w.members}</span>
          )}
        </div>
      </div>
      <p id={`win-${w.id}`} className="display mt-4 text-[2rem] leading-tight text-[#fff6dc]">{name}</p>
      <p className="text-[0.85rem] font-bold text-[#cdb57a]">{couple ? "A couple on Amah" : `A friend room of ${w.members}`}</p>
      <p className="mt-3 inline-block rounded-[16px] px-5 py-1 font-display text-[1.9rem] text-[#0d3b2e]" style={{ background: GOLD }} aria-label={`Grade ${w.grade}`}>
        {w.grade}
      </p>
      <dl className="mt-5 grid grid-cols-2 gap-2 text-left">
        {(couple
          ? [
              [`${s.days ?? 0} of 7`, "days together"],
              [String(s.games ?? 0), "games played"],
              [String(s.coop ?? 0), "team-up wins"],
              [String(s.dailies ?? 0), "daily questions"],
            ]
          : [
              [String(s.games ?? 0), "games played"],
              [`${s.active ?? 0} of ${s.members ?? 0}`, "of them playing"],
              [String(s.days ?? 0), "busy days"],
              [String(s.coop ?? 0), "team-up wins"],
            ]
        ).map(([v, l]) => (
          <div key={l} className="flex flex-col-reverse rounded-[14px] border border-[#d6ad5566] px-3 py-2.5">
            <dt className="text-[0.78rem] text-[#cdb57a]">{l}</dt>
            <dd className="text-[1.35rem] font-extrabold text-[#fff6dc]">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={send} disabled={loved || pending || w.mine} className="h-12 flex-1 rounded-full bg-[#f4e2b0] font-extrabold text-[#0d3b2e] disabled:opacity-70">
          {w.mine ? `${love} ${love === 1 ? "person sent" : "people sent"} you love` : loved ? `Love sent. ${love} so far` : "Send them love"}
        </button>
        {w.mine ? (
          <button type="button" onClick={() => setPoster(true)} className="h-12 flex-1 rounded-full border-[1.5px] border-[#d6ad55] font-extrabold text-[#f4e2b0]">
            Share your poster
          </button>
        ) : null}
      </div>
      {w.mine ? (
        <Modal open={poster} onClose={() => setPoster(false)} title="Your winner's poster" description="Swipe for a style. Made for your WhatsApp status.">
          <PosterStudio data={posterFor(w)} initial="owambe" fileName={couple ? "couple-of-the-week" : "gang-of-the-week"} shareText={couple ? "We're Couple of the Week on Amah!" : "We're Gang of the Week on Amah!"} />
        </Modal>
      ) : null}
    </section>
  );
}
