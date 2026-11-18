"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/design/icons";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { useSoloLimits } from "../SoloLimits";
import { BOTTLE_LOOKS, LEVELS, LEVELS_PER_STALL, RANKS, SHELF_LOOKS, STALLS, levelOpen, rankFor, stallOf } from "@/lib/solo/games/zobo";
import type { ZoboCareer } from "@/lib/solo/zobo-server";
import { buyZoboLook } from "@/lib/solo/shop-actions";

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
const BOTTLE_KEY = "amah:zobo:bottle";
const SHELF_KEY = "amah:zobo:shelf";
const remember = (key: string, id: string) => {
  try {
    localStorage.setItem(key, id);
  } catch {
    // Fine without.
  }
};
const recall = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

/** Zobo Sort's home: your rank, the five stalls and their levels, and your stall's shop. */
export function ZoboHome({ career }: { career: ZoboCareer }) {
  const { plusHref } = useSoloLimits();
  const [savings, setSavings] = useState(career.savings);
  const [owned, setOwned] = useState(career.looks);
  const [bottle, setBottle] = useState<string>(BOTTLE_LOOKS[0].id);
  const [shelf, setShelf] = useState<string>(SHELF_LOOKS[0].id);
  const [buying, setBuying] = useState<string | null>(null);
  useEffect(() => {
    setBottle(recall(BOTTLE_KEY, BOTTLE_LOOKS[0].id));
    setShelf(recall(SHELF_KEY, SHELF_LOOKS[0].id));
  }, []);

  const cleared = (n: number) => career.levelStars[n - 1]! > 0;
  const open = (n: number) => levelOpen(n, cleared);
  const next = Array.from({ length: LEVELS }, (_, i) => i + 1).find((n) => !cleared(n)) ?? LEVELS;
  const rank = rankFor(career.totalStars);
  const toNext = rank.next ? Math.min(1, (career.totalStars - rank.stars) / (rank.next.stars - rank.stars)) : 1;
  const nowStall = stallOf(next);
  // Without Plus, only today's level can be played once it has been started.
  const playable = career.free.used && career.free.level ? career.free.level : next;
  const waiting = career.free.used && career.free.level !== next;

  function pick(kind: "bottle" | "shelf", id: string) {
    if (kind === "bottle") {
      setBottle(id);
      remember(BOTTLE_KEY, id);
    } else {
      setShelf(id);
      remember(SHELF_KEY, id);
    }
  }
  async function buy(kind: "bottle" | "shelf", id: string) {
    setBuying(id);
    const r = await buyZoboLook({ item: id });
    setBuying(null);
    if (!r.ok) return void toast.error(r.error);
    setSavings(r.data.savings);
    setOwned((o) => [...o, id]);
    pick(kind, id);
    toast.success("It's on your stall now.");
  }

  const shop = (kind: "bottle" | "shelf", looks: readonly { id: string; name: string; price: number }[], current: string) => (
    <ul className="grid grid-cols-2 gap-2">
      {looks.map((l) => {
        const have = !l.price || owned.includes(l.id);
        const on = current === l.id;
        const afford = savings >= l.price;
        return (
          <li key={l.id}>
            <button
              type="button"
              disabled={buying !== null || (!have && !afford)}
              onClick={() => (have ? pick(kind, l.id) : void buy(kind, l.id))}
              aria-pressed={have ? on : undefined}
              aria-label={have ? `Use ${l.name}` : `Buy ${l.name} for ${naira(l.price)}`}
              className={cn("glass flex w-full items-center justify-between gap-2 rounded-[16px] border-2 px-3 py-2.5 text-left", on ? "border-[#8f1d40]" : "border-transparent", !have && !afford && "opacity-60")}
            >
              <span className="text-[0.85rem] font-bold leading-tight">{l.name}</span>
              <span className="shrink-0 text-[0.75rem] font-extrabold text-[#2e7d32]">{buying === l.id ? "Buying…" : have ? (on ? "In use" : "Yours") : naira(l.price)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="mx-auto max-w-[460px]">
      <div className="mt-16">
        <h1 className="display text-[2.2rem] leading-none">Zobo Sort</h1>
        <p className="mt-1.5 text-muted">Five stalls, 100 levels. Pour until every bottle holds one drink.</p>
      </div>

      <section aria-labelledby="zs-rank-h" className="mt-5 rounded-[20px] bg-[#8f1d40] px-4 py-3.5 text-[#fbeedd]">
        <div className="flex items-end justify-between gap-3">
          <span>
            <span className="text-[0.75rem]">Your rank</span>
            <b id="zs-rank-h" className="display block text-[1.45rem] leading-tight">{rank.name}</b>
          </span>
          <span className="text-right text-[0.8rem]">
            <b className="block text-[1.05rem]">{career.totalStars} ★</b>
            of {LEVELS * 3}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/25">
          <div className="h-full rounded-full bg-[#f2b632]" style={{ width: `${toNext * 100}%` }} />
        </div>
        <p className="mt-1.5 text-[0.78rem]">{rank.next ? `${rank.next.stars - career.totalStars} more stars to ${rank.next.name}.` : `The top of the market, out of ${RANKS.length} ranks.`}</p>
      </section>

      {waiting ? (
        <div className="glass mt-4 rounded-[20px] px-4 py-3.5 text-center">
          <p className="font-bold">Your next free level opens at midnight.</p>
          {plusHref ? <Link prefetch={false} href={plusHref} className="mt-1 inline-block text-[0.9rem] font-bold underline underline-offset-4">Play every level with Amah Plus</Link> : null}
        </div>
      ) : (
        <Link prefetch={false} href={`/solo/zobo-sort?mode=lvl-${playable}`} className="mt-4 flex h-14 items-center justify-center rounded-full bg-[#1c1416] text-[1.05rem] font-extrabold text-[#f6efe6]">
          Play level {playable}
        </Link>
      )}
      {career.free.limited && !waiting ? <p className="mt-2 text-center text-[0.82rem] font-semibold text-muted">One free level a day. You can retry it as often as you like.</p> : null}

      <section aria-labelledby="zs-stalls-h" className="mt-7">
        <h2 id="zs-stalls-h" className="display text-[1.35rem]">The stalls</h2>
        <ol className="mt-2 flex flex-col gap-2">
          {STALLS.map((stall, i) => {
            const first = i * LEVELS_PER_STALL + 1;
            const levels = Array.from({ length: LEVELS_PER_STALL }, (_, k) => first + k);
            const isOpen = open(first);
            const got = levels.reduce((t, n) => t + career.levelStars[n - 1]!, 0);
            if (!isOpen)
              return (
                <li key={stall.name} className="flex items-center gap-3 rounded-[18px] bg-[rgba(28,20,22,.05)] px-3.5 py-3 opacity-80">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(28,20,22,.12)] text-muted"><Icon name="lock" size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <b className="display block text-[1.05rem] leading-tight">{stall.name}</b>
                    <span className="block text-[0.75rem] leading-snug text-muted">{stall.about}</span>
                  </span>
                </li>
              );
            return (
              <li key={stall.name}>
                <details open={i === nowStall} className="glass rounded-[18px] px-3.5 py-3">
                  <summary className="flex cursor-pointer list-none items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f2b632] font-display text-[1.1rem] font-black text-[#2e1408]">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <b className="display block text-[1.05rem] leading-tight">{stall.name}</b>
                      <span className="block text-[0.75rem] leading-snug text-muted">{stall.about}</span>
                    </span>
                    <span className="shrink-0 text-[0.8rem] font-bold">{got}/{LEVELS_PER_STALL * 3} ★</span>
                  </summary>
                  <ol className="mt-3 grid grid-cols-5 gap-1.5">
                    {levels.map((n) => {
                      const st = career.levelStars[n - 1]!;
                      const can = open(n);
                      const body = (
                        <>
                          <span className="text-[0.95rem] font-extrabold leading-none">{n}</span>
                          <span className="mt-1 text-[0.6rem] leading-none tracking-[-0.05em] text-[#e3a417]">
                            {"★".repeat(st)}
                            <span className="text-[#d8cfc4]">{"★".repeat(3 - st)}</span>
                          </span>
                        </>
                      );
                      return (
                        <li key={n}>
                          {can ? (
                            <Link prefetch={false} href={`/solo/zobo-sort?mode=lvl-${n}`} aria-label={`Level ${n}, ${st} of 3 stars`} className={cn("flex h-12 flex-col items-center justify-center rounded-[12px] border-[1.5px] border-line", n === next && "border-[#8f1d40] bg-[rgba(143,29,64,.1)]")}>
                              {body}
                            </Link>
                          ) : (
                            <span className="flex h-12 items-center justify-center rounded-[12px] bg-[rgba(28,20,22,.06)] text-muted" aria-label={`Level ${n}, locked`}><Icon name="lock" size={13} /></span>
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

      <section aria-labelledby="zs-shop-h" className="mt-7">
        <h2 id="zs-shop-h" className="display text-[1.35rem]">Your stall</h2>
        <div className="mt-2 flex items-center justify-between rounded-[20px] bg-[#2c0816] px-4 py-3.5 text-[#fbeedd]">
          <span>
            <span className="text-[0.8rem]">Your savings</span>
            <b className="display block text-[1.7rem] leading-tight text-[#f2b632]">{naira(savings)}</b>
          </span>
          <span className="text-right text-[0.78rem]">Every level you finish<br />pays in here.</span>
        </div>
        <h3 className="mb-2 ml-1 mt-4 text-[0.8rem] font-extrabold text-muted">Bottles</h3>
        {shop("bottle", BOTTLE_LOOKS, bottle)}
        <h3 className="mb-2 ml-1 mt-4 text-[0.8rem] font-extrabold text-muted">Shelves</h3>
        {shop("shelf", SHELF_LOOKS, shelf)}
      </section>
    </div>
  );
}
