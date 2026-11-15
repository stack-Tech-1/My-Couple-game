"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/design/Button";
import { Icon } from "@/design/icons";
import { Modal } from "@/design/Modal";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { AREAS, DAYS, DIFFICULTIES, DIFFICULTY_NAME, FREE_CAREER_MODES, ITEM_NAME, KITCHENS, careerDay, dayOpen, newOnDay, upgradePrice, upgradesFor, vibeWeight, type Difficulty, type UpgradeId } from "@/lib/solo/games/mama";
import type { MamaCareer } from "@/lib/solo/mama-server";
import { buyMamaUpgrade } from "@/lib/solo/shop-actions";
import { src, upgradePic } from "./looks";

/** Each area's colour on the map. */
const AREA_LOOK = ["#2f8a86", "#c08410", "#d9521f", "#6b4b9a", "#1c3f78"] as const;
const AREA_NOTE = ["Free to play, as much as you like", "", "", "", "The big leagues"] as const;
const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
const DIFF_ABOUT: Record<Difficulty, string> = { easy: "Patient customers, smaller orders", normal: "The lunch rush you know", hard: "Short tempers, big orders" };

export function MamaHome({ career }: { career: MamaCareer }) {
  const [savings, setSavings] = useState(career.savings);
  const [owned, setOwned] = useState(career.owned);
  const [rush, setRush] = useState<Difficulty>("normal");
  const [buying, setBuying] = useState<UpgradeId | null>(null);
  const [bought, setBought] = useState<UpgradeId | null>(null);

  const best = (day: number) => career.dayBest[day - 1] ?? undefined;
  const open = (day: number) => dayOpen(day, best);
  const totalStars = career.dayStars.reduce((a, b) => a + b, 0);
  // Next up: the first open day without a star, else the first open one short of three.
  const days = Array.from({ length: DAYS }, (_, i) => i + 1);
  const next = days.find((d) => open(d) && !career.dayStars[d - 1]) ?? days.find((d) => open(d) && career.dayStars[d - 1]! < 3) ?? DAYS;
  const nextArea = Math.floor((next - 1) / 6);
  const newDishes = newOnDay(next);
  // The shop shows the furthest area you've reached; earlier ones are a tap away.
  const reached = Math.max(0, ...days.filter(open).map((d) => Math.floor((d - 1) / 6)));
  const [area, setArea] = useState(reached);
  const areaOwned = owned[area] ?? [];
  // Each restaurant's own version of every upgrade.
  const ups = upgradesFor(area);
  const boost = Math.round(ups.filter((u) => areaOwned.includes(u.id)).reduce((t, u) => t + u.patience, 0) * vibeWeight(area * 6 + 1) * 100);
  const maxBoost = Math.round(ups.reduce((t, u) => t + u.patience, 0) * vibeWeight(area * 6 + 1) * 100);

  async function buy(id: UpgradeId) {
    setBuying(id);
    const r = await buyMamaUpgrade({ area, item: id });
    setBuying(null);
    if (!r.ok) return void toast.error(r.error);
    setSavings(r.data.savings);
    setOwned((o) => o.map((list, i) => (i === area ? r.data.owned : list)));
    setBought(id);
  }

  const boughtUp = bought ? ups.find((u) => u.id === bought)! : null;
  return (
    <div className="mx-auto max-w-[460px]">
      <div className="mt-5">
        <h1 className="display text-[2.2rem] leading-none">Mama Put</h1>
        <p className="mt-1.5 text-muted">Run the buka across Lagos, one lunch rush at a time.</p>
      </div>

      {/* The career */}
      <section aria-labelledby="mp-career-h" className="mt-6">
        <div className="flex items-baseline justify-between px-0.5">
          <h2 id="mp-career-h" className="display text-[1.35rem]">Your career</h2>
          <span className="text-[0.8rem] font-semibold text-muted">
            {totalStars} of {DAYS * 3} ★
          </span>
        </div>
        <Link prefetch={false} href={`/solo/mama-put?mode=day-${next}`} className="mt-2 flex items-center justify-between gap-3 rounded-[20px] px-4 py-3.5 text-white shadow-[0_12px_24px_-16px_rgba(0,0,0,.6)]" style={{ background: AREA_LOOK[nextArea] }}>
          <span className="min-w-0">
            <b className="display block text-[1.3rem] leading-tight">
              Day {next} · {AREAS[nextArea]}
            </b>
            <span className="text-[0.82rem] opacity-90">
              {newDishes.length ? `New today: ${newDishes.map((x) => ITEM_NAME[x]).join(", ")}.` : career.dayStars[next - 1] ? `You have ${career.dayStars[next - 1]} ★ here. Go for three.` : "Customers get a little quicker to vex each day."}
              {(FREE_CAREER_MODES as readonly string[]).includes(`day-${next}`) ? " Free to play." : ""}
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-white px-4 py-2 text-[0.95rem] font-extrabold" style={{ color: AREA_LOOK[nextArea] }}>
            Play
          </span>
        </Link>

        <div className="mt-2.5 flex flex-col gap-2">
          {AREAS.map((name, a) => {
            const areaDays = days.slice(a * 6, a * 6 + 6);
            const stars = areaDays.reduce((t, d) => t + career.dayStars[d - 1]!, 0);
            const locked = !open(areaDays[0]!);
            return (
              <div key={name} className={cn("rounded-[18px] px-3 pb-3 pt-2.5 text-white", locked && "opacity-75")} style={{ background: AREA_LOOK[a] }}>
                <div className="flex items-baseline justify-between text-[0.82rem] font-extrabold">
                  <span>{name}</span>
                  <span className="font-semibold opacity-90">{locked ? `Clear ${AREAS[a - 1]} first` : `${stars} of 18 ★${AREA_NOTE[a] ? ` · ${AREA_NOTE[a]}` : ""}`}</span>
                </div>
                <ol className="mt-2 grid grid-cols-6 gap-1.5">
                  {areaDays.map((d) => {
                    const st = career.dayStars[d - 1]!;
                    const isOpen = open(d);
                    const now = d === next;
                    const label = `Day ${d}${isOpen ? `, ${st} of 3 stars` : ", locked"}`;
                    const tile = (
                      <>
                        <span className="display text-[1rem] leading-none">{d}</span>
                        {isOpen ? (
                          <span className="mt-0.5 text-[0.55rem] tracking-[-0.05em] text-[#e3a417]">
                            {"★".repeat(st)}
                            <span className="text-[#d8cfc4]">{"★".repeat(3 - st)}</span>
                          </span>
                        ) : (
                          <Icon name="lock" size={11} className="mt-0.5 opacity-80" />
                        )}
                        {isOpen && !best(d) && newOnDay(d).length ? <span className="absolute -right-1.5 -top-1.5 rounded-full bg-[#2e9b57] px-1 text-[0.5rem] font-extrabold leading-[1.5]">NEW</span> : null}
                      </>
                    );
                    return (
                      <li key={d}>
                        {isOpen ? (
                          <Link prefetch={false} href={`/solo/mama-put?mode=day-${d}`} aria-label={label} className={cn("relative flex aspect-square flex-col items-center justify-center rounded-[12px] bg-white/95 text-[#2a1d17]", now && "outline outline-[3px] outline-offset-2 outline-[#f6c453]")}>
                            {tile}
                          </Link>
                        ) : (
                          <span aria-label={label} className="relative flex aspect-square flex-col items-center justify-center rounded-[12px] bg-white/25 text-white/80">
                            {tile}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
        </div>
      </section>

      {/* Quick rush */}
      <section aria-labelledby="mp-rush-h" className="mt-7">
        <div className="flex items-baseline justify-between px-0.5">
          <h2 id="mp-rush-h" className="display text-[1.35rem]">Quick rush</h2>
          <span className="text-[0.8rem] font-semibold text-muted">90 seconds, full menu</span>
        </div>
        <div role="radiogroup" aria-label="Difficulty" className="mt-2 grid grid-cols-3 gap-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={rush === d}
              onClick={() => setRush(d)}
              className={cn("glass rounded-[16px] border-2 px-2 py-3 text-center", rush === d ? "border-[#d9521f]" : "border-transparent")}
            >
              <b className="display block text-[1.05rem]">{DIFFICULTY_NAME[d]}</b>
              <span className="mt-0.5 block text-[0.72rem] leading-snug text-muted">{DIFF_ABOUT[d]}</span>
              <span className="mt-1.5 block text-[0.72rem] font-extrabold text-[#2e7d32]">{career.quickBest[d] != null ? `Best ${naira(career.quickBest[d]!)}` : "Not played"}</span>
            </button>
          ))}
        </div>
        <Link prefetch={false} href={`/solo/mama-put?mode=${rush}`} className="mt-2.5 flex items-center justify-between rounded-[18px] bg-[#2a1d17] px-4 py-3.5 text-white">
          <span>
            <b className="display block text-[1.2rem]">{DIFFICULTY_NAME[rush]} rush</b>
            <span className="text-[0.8rem] opacity-85">Each difficulty has its own leaderboard.</span>
          </span>
          <span className="rounded-full bg-white px-4 py-2 font-extrabold text-[#2a1d17]">Play</span>
        </Link>
      </section>

      {/* The shop */}
      <section aria-labelledby="mp-shop-h" className="mt-7">
        <div className="flex items-baseline justify-between px-0.5">
          <h2 id="mp-shop-h" className="display text-[1.35rem]">{area ? KITCHENS[area]!.name : "Your buka"}</h2>
          <span className="text-[0.8rem] font-semibold text-muted">Upgrades help in the career</span>
        </div>
        <div className="mt-2 flex items-center justify-between rounded-[20px] bg-[#2a1a10] px-4 py-3.5 text-white">
          <span>
            <span className="text-[0.8rem] text-[#e6cdb9]">Your savings</span>
            <b className="display block text-[1.7rem] leading-tight text-[#f6c453]">{naira(savings)}</b>
          </span>
          <span className="text-right text-[0.78rem] text-[#e6cdb9]">
            Everything you take in
            <br />
            goes here.
          </span>
        </div>
        {reached > 0 ? (
          <div role="tablist" aria-label="Restaurant" className="mt-2.5 flex gap-1.5 overflow-x-auto">
            {AREAS.slice(0, reached + 1).map((n, a) => (
              <button key={n} type="button" role="tab" aria-selected={area === a} onClick={() => setArea(a)} className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-[0.82rem] font-bold", area === a ? "text-white" : "glass")} style={area === a ? { background: AREA_LOOK[a] } : undefined}>
                {n}
              </button>
            ))}
          </div>
        ) : null}
        <div className="glass mt-2.5 rounded-[18px] px-4 py-3">
          <div className="flex justify-between text-[0.85rem] font-bold">
            <span>Customer patience in {AREAS[area]}</span>
            <span className="text-[#2e7d32]">+{boost}%</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#eadfd2]">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,#2f8a4e,#6cc08b)] transition-[width] duration-500" style={{ width: `${maxBoost ? (boost / maxBoost) * 100 : 0}%` }} />
          </div>
          <p className="mt-1.5 text-[0.75rem] text-muted">Each restaurant is kitted out on its own. Up to +{maxBoost}% here.</p>
        </div>
        {(["vibe", "kitchen"] as const).map((kind) => (
          <div key={kind}>
            <h3 className="mb-2 ml-1 mt-4 text-[0.8rem] font-extrabold text-muted">{kind === "vibe" ? "Ambience" : "Kitchen · helps every day"}</h3>
            <ul className="grid grid-cols-3 gap-2">
              {ups.filter((u) => u.kind === kind).map((u) => {
                const have = areaOwned.includes(u.id);
                const price = upgradePrice(area, u.id);
                const afford = savings >= price;
                return (
                  <li key={u.id} className="glass relative flex flex-col items-center rounded-[18px] px-2 pb-2.5 pt-2.5 text-center">
                    {have ? (
                      <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#2e9b57] text-white">
                        <Icon name="check" size={12} />
                      </span>
                    ) : null}
                    <span className="flex h-[60px] items-end justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element -- tiny local art, already sized */}
                      <img src={src(upgradePic(area, u.id))} alt="" className="max-h-[60px] max-w-[84px] object-contain" />
                    </span>
                    <b className="display mt-1.5 text-[0.85rem] leading-tight">{u.name}</b>
                    <span className="mt-0.5 min-h-[2.2em] text-[0.68rem] leading-snug text-muted">{u.kind === "vibe" ? `+${Math.round(u.patience * 100)}% patience` : u.about}</span>
                    {have ? (
                      <span className="mt-1.5 w-full rounded-full bg-[rgba(46,155,87,.14)] py-1.5 text-[0.75rem] font-extrabold text-[#2e7d32]">{area ? "Bought" : "In your buka"}</span>
                    ) : (
                      <button
                        type="button"
                        disabled={!afford || buying !== null}
                        onClick={() => void buy(u.id)}
                        aria-label={`Buy ${u.name} for ${naira(price)}`}
                        className={cn("mt-1.5 w-full rounded-full py-1.5 text-[0.78rem] font-extrabold", afford ? "bg-[#d9521f] text-white" : "bg-[#eadfd2] text-[#9a8a7e]")}
                      >
                        {buying === u.id ? "Buying…" : naira(price)}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <p className="mt-3 text-center text-[0.75rem] text-muted">Quick rushes use a standard buka for everyone, so their leaderboards stay fair.</p>
      </section>

      <Modal open={!!boughtUp} onClose={() => setBought(null)} title={boughtUp ? (boughtUp.id === "tv" ? "The match is on!" : `New in ${area ? KITCHENS[area]!.name : "your buka"}: ${boughtUp.name.toLowerCase()}`) : ""}>
        {boughtUp ? (
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny local art */}
            <img src={src(upgradePic(area, boughtUp.id))} alt="" className="mx-auto h-28 object-contain" />
            <p className="mt-3 text-muted">{boughtUp.about}</p>
            {boughtUp.kind === "vibe" ? (
              <p className="mt-3 inline-block rounded-full bg-[rgba(46,155,87,.14)] px-3.5 py-1.5 text-[0.85rem] font-extrabold text-[#2e7d32]">
                Patience in {AREAS[area]}: +{boost}%
              </p>
            ) : null}
            <div className="mt-5 flex flex-col gap-2">
              <Link prefetch={false} href={`/solo/mama-put?mode=day-${area === nextArea ? next : area * 6 + 1}`} className="inline-flex h-14 items-center justify-center rounded-full bg-fg font-semibold text-bg">
                See it in {area ? KITCHENS[area]!.name : "your buka"}
              </Link>
              <Button size="lg" variant="ghost" onClick={() => setBought(null)}>
                Keep shopping
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

/** Stars a career day's takings earn (for the finish screen). */
export const dayStarsFor = (day: number, money: number) => careerDay(day).stars.filter((x) => money >= x).length;
