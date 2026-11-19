"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/design/icons";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { useSoloLimits } from "../SoloLimits";
import { YourStreet } from "./YourStreet";
import { BUILDINGS, RANKS, SITES, WALLS, WALLS_PER_SITE, rankFor, siteOf, wallOpen } from "@/lib/solo/games/bashwall";
import type { BashCareer } from "@/lib/solo/bash-server";
import { buyBashBuilding } from "@/lib/solo/shop-actions";

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

/** Bash Am's home: your rank, your street, the five sites and their walls, and Endless Street. */
export function BashHome({ career }: { career: BashCareer }) {
  const { plusHref } = useSoloLimits();
  const [savings, setSavings] = useState(career.savings);
  const [built, setBuilt] = useState<string[]>(career.built);
  const [buying, setBuying] = useState<string | null>(null);

  const cleared = (n: number) => career.wallStars[n - 1]! > 0;
  const open = (n: number) => wallOpen(n, cleared);
  const next = Array.from({ length: WALLS }, (_, i) => i + 1).find((n) => !cleared(n)) ?? WALLS;
  const rank = rankFor(career.totalStars);
  const toNext = rank.next ? Math.min(1, (career.totalStars - rank.stars) / (rank.next.stars - rank.stars)) : 1;

  async function buy(id: string) {
    setBuying(id);
    const r = await buyBashBuilding({ item: id });
    setBuying(null);
    if (!r.ok) return void toast.error(r.error);
    setSavings(r.data.savings);
    setBuilt((b) => [...b, id]);
    toast.success("It's up on your street.");
  }

  return (
    <div className="mx-auto max-w-[460px]">
      <div className="mt-16">
        <h1 className="display text-[2.2rem] leading-none">Bash Am</h1>
        <p className="mt-1.5 text-muted">Five sites, {WALLS} walls. Break them, then build.</p>
      </div>

      <section aria-labelledby="ba-rank-h" className="mt-5 rounded-[20px] bg-[#7c2f16] px-4 py-3.5 text-[#f8f0e4]">
        <div className="flex items-end justify-between gap-3">
          <span>
            <span className="text-[0.75rem]">Your rank</span>
            <b id="ba-rank-h" className="display block text-[1.45rem] leading-tight">{rank.name}</b>
          </span>
          <span className="text-right text-[0.8rem]">
            <b className="block text-[1.05rem]">{career.totalStars} ★</b>
            of {WALLS * 3}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/30">
          <div className="h-full rounded-full bg-[#f6c453]" style={{ width: `${toNext * 100}%` }} />
        </div>
        <p className="mt-1.5 text-[0.78rem]">{rank.next ? `${rank.next.stars - career.totalStars} more stars to ${rank.next.name}.` : `The top of the ${RANKS.length} ranks. The street is yours.`}</p>
      </section>

      {career.locked ? (
        <div className="glass mt-4 rounded-[20px] px-4 py-4 text-center">
          <p className="display text-[1.3rem] leading-tight">Bash Am comes with Amah Plus</p>
          <p className="mt-1 text-[0.88rem] text-muted">Play every wall and build your street. Try it free for 7 days.</p>
          {plusHref ? (
            <Link prefetch={false} href={plusHref} className="mt-3 inline-flex h-12 items-center rounded-full bg-[#1c1416] px-6 font-extrabold text-[#f6efe6]">
              Try Amah Plus
            </Link>
          ) : null}
        </div>
      ) : (
        <Link prefetch={false} href={`/solo/bash-am?mode=wall-${next}`} className="mt-4 flex h-14 items-center justify-center rounded-full bg-[#1c1416] text-[1.05rem] font-extrabold text-[#f6efe6]">
          Play wall {next}
        </Link>
      )}

      <section aria-labelledby="ba-sites-h" className="mt-7">
        <h2 id="ba-sites-h" className="display text-[1.35rem]">The sites</h2>
        <ol className="mt-2 flex flex-col gap-2">
          {SITES.map((site, i) => {
            const first = i * WALLS_PER_SITE + 1;
            const walls = Array.from({ length: WALLS_PER_SITE }, (_, k) => first + k);
            const got = walls.reduce((t, n) => t + career.wallStars[n - 1]!, 0);
            if (!open(first) || career.locked)
              return (
                <li key={site.name} className="flex items-center gap-3 rounded-[18px] bg-[rgba(28,20,22,.05)] px-3.5 py-3 opacity-80">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(28,20,22,.12)] text-muted"><Icon name="lock" size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <b className="display block text-[1.05rem] leading-tight">{site.name}</b>
                    <span className="block text-[0.75rem] leading-snug text-muted">{site.place}. {site.about}</span>
                  </span>
                </li>
              );
            return (
              <li key={site.name}>
                <details open={i === siteOf(next)} className="glass rounded-[18px] px-3.5 py-3">
                  <summary className="flex cursor-pointer list-none items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f6c453] font-display text-[1.1rem] font-black text-[#2e1408]">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <b className="display block text-[1.05rem] leading-tight">{site.name}</b>
                      <span className="block text-[0.75rem] leading-snug text-muted">{site.place}. {site.about}</span>
                    </span>
                    <span className="shrink-0 text-[0.8rem] font-bold">{got}/{WALLS_PER_SITE * 3} ★</span>
                  </summary>
                  <ol className="mt-3 grid grid-cols-5 gap-1.5">
                    {walls.map((n) => {
                      const st = career.wallStars[n - 1]!;
                      const boss = n % WALLS_PER_SITE === 0;
                      return (
                        <li key={n}>
                          {open(n) ? (
                            <Link prefetch={false} href={`/solo/bash-am?mode=wall-${n}`} aria-label={`Wall ${n}${boss ? `, ${site.boss}` : ""}, ${st} of 3 stars`} className={cn("flex h-12 flex-col items-center justify-center rounded-[12px] border-[1.5px] border-line", n === next && "border-[#7c2f16] bg-[rgba(124,47,22,.1)]", boss && "bg-[rgba(232,86,58,.1)]")}>
                              <span className="text-[0.95rem] font-extrabold leading-none">{n}</span>
                              <span className="mt-1 text-[0.6rem] leading-none tracking-[-0.05em] text-[#e3a417]">
                                {"★".repeat(st)}
                                <span className="text-[#d8cfc4]">{"★".repeat(3 - st)}</span>
                              </span>
                            </Link>
                          ) : (
                            <span className="flex h-12 items-center justify-center rounded-[12px] bg-[rgba(28,20,22,.06)] text-muted" aria-label={`Wall ${n}, locked`}><Icon name="lock" size={13} /></span>
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

      {!career.locked ? (
        <section aria-labelledby="ba-end-h" className="mt-7">
          <h2 id="ba-end-h" className="display text-[1.35rem]">Endless Street</h2>
          <Link prefetch={false} href="/solo/bash-am?mode=normal" className="glass mt-2 flex items-center justify-between gap-3 rounded-[18px] px-4 py-3.5">
            <span>
              <b className="block">Play Endless Street</b>
              <span className="text-[0.8rem] text-muted">Street after street with no buildings, so the leaderboard is fair.</span>
            </span>
            <Icon name="arrowRight" size={18} />
          </Link>
        </section>
      ) : null}

      <section aria-labelledby="ba-street-h" className="mt-7">
        <h2 id="ba-street-h" className="display text-[1.35rem]">Your street</h2>
        <div className="mt-2 overflow-hidden rounded-[20px] bg-[#7c2f16] text-[#f8f0e4]">
          <YourStreet built={built} />
          <div className="flex items-center justify-between px-4 py-3">
            <span>
              <span className="text-[0.8rem]">Your savings</span>
              <b className="display block text-[1.7rem] leading-tight text-[#f6c453]">{naira(savings)}</b>
            </span>
            <span className="text-right text-[0.78rem]">{built.length} of {BUILDINGS.length} built.<br />Every wall you clear pays in here.</span>
          </div>
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {BUILDINGS.map((b) => {
            const have = built.includes(b.id);
            const afford = savings >= b.price;
            return (
              <li key={b.id} className="glass flex items-center justify-between gap-3 rounded-[16px] px-3.5 py-2.5">
                <span className="min-w-0">
                  <b className="block text-[0.95rem] leading-tight">{b.name}</b>
                  <span className="text-[0.78rem] text-muted">{b.about}</span>
                </span>
                {have ? (
                  <span className="shrink-0 text-[0.82rem] font-extrabold text-[#2e7d32]">Built</span>
                ) : (
                  <button type="button" disabled={buying !== null || !afford || career.locked} onClick={() => void buy(b.id)} aria-label={`Build ${b.name} for ${naira(b.price)}`} className={cn("h-10 shrink-0 rounded-full bg-[#1c1416] px-4 text-[0.85rem] font-extrabold text-[#f6efe6]", (!afford || career.locked) && "opacity-50")}>
                    {buying === b.id ? "Building…" : naira(b.price)}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[0.78rem] text-muted">Buildings help on career walls only.</p>
      </section>
    </div>
  );
}
