"use client";

import Link from "next/link";
import { BackButton } from "@/design/BackButton";
import { useState } from "react";
import { Icon } from "@/design/icons";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { useSoloLimits } from "../SoloLimits";
import { GEAR, NIGHTS, NIGHTS_PER_ROOM, RANKS, ROOMS, nightOpen, rankFor, roomOf } from "@/lib/solo/games/mosquito";
import type { MosquitoCareer } from "@/lib/solo/mosquito-server";
import { buyMosquitoGear } from "@/lib/solo/shop-actions";

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

/** Mosquito Wahala's home: your rank, the five rooms and their nights, All Night and the shop. */
export function MosquitoHome({ career }: { career: MosquitoCareer }) {
  const { plusHref } = useSoloLimits();
  const [savings, setSavings] = useState(career.savings);
  const [owned, setOwned] = useState<string[]>(career.gear);
  const [buying, setBuying] = useState<string | null>(null);

  const cleared = (n: number) => career.nightStars[n - 1]! > 0;
  const open = (n: number) => nightOpen(n, cleared);
  const next = Array.from({ length: NIGHTS }, (_, i) => i + 1).find((n) => !cleared(n)) ?? NIGHTS;
  const rank = rankFor(career.totalStars);
  const toNext = rank.next ? Math.min(1, (career.totalStars - rank.stars) / (rank.next.stars - rank.stars)) : 1;
  const out = career.free.limited && career.free.left <= 0;

  async function buy(id: string) {
    setBuying(id);
    const r = await buyMosquitoGear({ item: id });
    setBuying(null);
    if (!r.ok) return void toast.error(r.error);
    setSavings(r.data.savings);
    setOwned((o) => [...o, id]);
    toast.success("It's in your room now.");
  }

  return (
    <div className="mx-auto max-w-[460px]">
      <BackButton href="/solo" label="Solo" />
      <div className="mt-5">
        <h1 className="display text-[2.2rem] leading-none">Mosquito Wahala</h1>
        <p className="mt-1.5 text-muted">Five rooms, {NIGHTS} nights. Sleep till morning.</p>
      </div>

      <section aria-labelledby="mq-rank-h" className="mt-5 rounded-[20px] bg-[#2c2857] px-4 py-3.5 text-[#f6efe6]">
        <div className="flex items-end justify-between gap-3">
          <span>
            <span className="text-[0.75rem]">Your rank</span>
            <b id="mq-rank-h" className="display block text-[1.45rem] leading-tight">{rank.name}</b>
          </span>
          <span className="text-right text-[0.8rem]">
            <b className="block text-[1.05rem]">{career.totalStars} ★</b>
            of {NIGHTS * 3}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/30">
          <div className="h-full rounded-full bg-[#f6d67a]" style={{ width: `${toNext * 100}%` }} />
        </div>
        <p className="mt-1.5 text-[0.78rem]">{rank.next ? `${rank.next.stars - career.totalStars} more stars to ${rank.next.name}.` : `The top of the ${RANKS.length} ranks. Sleep well.`}</p>
      </section>

      {out ? (
        <div className="glass mt-4 rounded-[20px] px-4 py-3.5 text-center">
          <p className="font-bold">Your free nights come back at midnight.</p>
          {plusHref ? <Link prefetch={false} href={plusHref} className="mt-1 inline-block text-[0.9rem] font-bold underline underline-offset-4">Play every night with Amah Plus</Link> : null}
        </div>
      ) : (
        <Link prefetch={false} href={`/solo/mosquito-wahala?mode=night-${next}`} className="mt-4 flex h-14 items-center justify-center rounded-full bg-[#1c1416] text-[1.05rem] font-extrabold text-[#f6efe6]">
          Play night {next}
        </Link>
      )}
      {career.free.limited && !out ? <p className="mt-2 text-center text-[0.82rem] font-semibold text-muted">Two free games a day. {career.free.left === 1 ? "1 left" : `${career.free.left} left`} today.</p> : null}

      <section aria-labelledby="mq-rooms-h" className="mt-7">
        <h2 id="mq-rooms-h" className="display text-[1.35rem]">The rooms</h2>
        <ol className="mt-2 flex flex-col gap-2">
          {ROOMS.map((room, i) => {
            const first = i * NIGHTS_PER_ROOM + 1;
            const nights = Array.from({ length: NIGHTS_PER_ROOM }, (_, k) => first + k);
            const got = nights.reduce((t, n) => t + career.nightStars[n - 1]!, 0);
            if (!open(first))
              return (
                <li key={room.name} className="flex items-center gap-3 rounded-[18px] bg-[rgba(28,20,22,.05)] px-3.5 py-3 opacity-80">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(28,20,22,.12)] text-muted"><Icon name="lock" size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <b className="display block text-[1.05rem] leading-tight">{room.name}</b>
                    <span className="block text-[0.75rem] leading-snug text-muted">{room.place}. {room.about}</span>
                  </span>
                </li>
              );
            return (
              <li key={room.name}>
                <details open={i === roomOf(next)} className="glass rounded-[18px] px-3.5 py-3">
                  <summary className="flex cursor-pointer list-none items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f6d67a] font-display text-[1.1rem] font-black text-[#2e1408]">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <b className="display block text-[1.05rem] leading-tight">{room.name}</b>
                      <span className="block text-[0.75rem] leading-snug text-muted">{room.place}. {room.about}</span>
                    </span>
                    <span className="shrink-0 text-[0.8rem] font-bold">{got}/{NIGHTS_PER_ROOM * 3} ★</span>
                  </summary>
                  <ol className="mt-3 grid grid-cols-5 gap-1.5">
                    {nights.map((n) => {
                      const st = career.nightStars[n - 1]!;
                      const boss = n % NIGHTS_PER_ROOM === 0;
                      const label = `Night ${n}${boss ? `, ${room.boss}` : ""}, ${st} of 3 stars`;
                      return (
                        <li key={n}>
                          {open(n) ? (
                            <Link prefetch={false} href={`/solo/mosquito-wahala?mode=night-${n}`} aria-label={label} className={cn("flex h-12 flex-col items-center justify-center rounded-[12px] border-[1.5px] border-line", n === next && "border-[#2c2857] bg-[rgba(44,40,87,.1)]", boss && "bg-[rgba(232,86,58,.1)]")}>
                              <span className="text-[0.95rem] font-extrabold leading-none">{n}</span>
                              <span className="mt-1 text-[0.6rem] leading-none tracking-[-0.05em] text-[#e3a417]">
                                {"★".repeat(st)}
                                <span className="text-[#d8cfc4]">{"★".repeat(3 - st)}</span>
                              </span>
                            </Link>
                          ) : (
                            <span className="flex h-12 items-center justify-center rounded-[12px] bg-[rgba(28,20,22,.06)] text-muted" aria-label={`Night ${n}, locked`}><Icon name="lock" size={13} /></span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </details>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="mq-all-h" className="mt-7">
        <h2 id="mq-all-h" className="display text-[1.35rem]">All Night</h2>
        {out ? (
          <p className="mt-2 text-[0.9rem] text-muted">Endless waves, back at midnight with your free games.</p>
        ) : (
          <Link prefetch={false} href="/solo/mosquito-wahala?mode=normal" className="glass mt-2 flex items-center justify-between gap-3 rounded-[18px] px-4 py-3.5">
            <span>
              <b className="block">Play All Night</b>
              <span className="text-[0.8rem] text-muted">Endless waves with no upgrades, so the leaderboard is fair.</span>
            </span>
            <Icon name="arrowRight" size={18} />
          </Link>
        )}
      </section>

      <section aria-labelledby="mq-shop-h" className="mt-7">
        <h2 id="mq-shop-h" className="display text-[1.35rem]">The shop</h2>
        <div className="mt-2 flex items-center justify-between rounded-[20px] bg-[#2c2857] px-4 py-3.5 text-[#f6efe6]">
          <span>
            <span className="text-[0.8rem]">Your savings</span>
            <b className="display block text-[1.7rem] leading-tight text-[#f6d67a]">{naira(savings)}</b>
          </span>
          <span className="text-right text-[0.78rem]">Every night you survive<br />pays in here.</span>
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {GEAR.map((g) => {
            const have = owned.includes(g.id);
            const afford = savings >= g.price;
            return (
              <li key={g.id} className="glass flex items-center justify-between gap-3 rounded-[16px] px-3.5 py-2.5">
                <span className="min-w-0">
                  <b className="block text-[0.95rem] leading-tight">{g.name}</b>
                  <span className="text-[0.78rem] text-muted">{g.about}</span>
                </span>
                {have ? (
                  <span className="shrink-0 text-[0.82rem] font-extrabold text-[#2e7d32]">Yours</span>
                ) : (
                  <button type="button" disabled={buying !== null || !afford} onClick={() => void buy(g.id)} aria-label={`Buy ${g.name} for ${naira(g.price)}`} className={cn("h-10 shrink-0 rounded-full bg-[#1c1416] px-4 text-[0.85rem] font-extrabold text-[#f6efe6]", !afford && "opacity-50")}>
                    {buying === g.id ? "Buying…" : naira(g.price)}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[0.78rem] text-muted">Gear works on career nights only.</p>
      </section>
    </div>
  );
}
