"use client";

import Link from "next/link";
import { BackButton } from "@/design/BackButton";
import { useSoloLimits } from "../SoloLimits";
import { untilText } from "@/lib/plus/plans";
import { useEffect, useState } from "react";
import { Icon } from "@/design/icons";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { GEAR, RANKS, ROUTES, ROUTE_ABOUT, SKINS, rankFor, routeOpen, type GearId, type SkinId } from "@/lib/solo/games/okada";
import type { OkadaCareer } from "@/lib/solo/okada-server";
import { buyOkadaGear } from "@/lib/solo/shop-actions";

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
const SKIN_COLOUR: Record<SkinId, string> = { "skin-red": "#d23a2b", "skin-blue": "#2f62b5", "skin-black": "#2a2526", "skin-gold": "#d9a400", "skin-green": "linear-gradient(90deg,#2e8b57 50%,#f4f1ea 50%)", "skin-pink": "#e86aa6" };
const SKIN_KEY = "amah:okada:skin";
const ART = "/games/okada/";

/** Okada Rush's home: your rank, the five routes, Free Ride, and the garage. */
export function OkadaHome({ career }: { career: OkadaCareer }) {
  const [savings, setSavings] = useState(career.savings);
  const [gear, setGear] = useState<string[]>(career.gear);
  const [skins, setSkins] = useState<string[]>(career.skins);
  const [skin, setSkin] = useState<SkinId>(career.skin);
  const [buying, setBuying] = useState<string | null>(null);

  // The colour you picked last time, if you still have it.
  useEffect(() => {
    try {
      const k = localStorage.getItem(SKIN_KEY);
      if (k && career.skins.includes(k as SkinId)) setSkin(k as SkinId);
    } catch {
      // No storage: the latest colour bought.
    }
  }, [career.skins]);
  const pick = (k: SkinId) => {
    setSkin(k);
    try {
      localStorage.setItem(SKIN_KEY, k);
    } catch {
      // Fine without.
    }
  };

  async function buy(item: string) {
    setBuying(item);
    const r = await buyOkadaGear({ item });
    setBuying(null);
    if (!r.ok) return void toast.error(r.error);
    setSavings(r.data.savings);
    if (item.startsWith("skin-")) {
      setSkins((s) => [...s, item]);
      pick(item as SkinId);
      toast.success("New colour on your okada.");
    } else {
      setGear((g) => [...g, item]);
      toast.success(`${GEAR.find((g) => g.id === item)?.name} is on your okada.`);
    }
  }

  const best = (n: number) => career.routeBest[n - 1] ?? undefined;
  // Without Plus, Yaba streets is the free taste (twice a day).
  const open = (n: number) => (career.locked ? n === 1 : routeOpen(n, best));
  const rank = rankFor(career.km);
  const toNext = rank.next ? Math.min(1, (career.km - rank.km) / (rank.next.km - rank.km)) : 1;
  const next = [1, 2, 3, 4, 5].find((n) => open(n) && !career.routeStars[n - 1]) ?? [1, 2, 3, 4, 5].find((n) => open(n) && career.routeStars[n - 1]! < 3) ?? 1;
  const withSkin = (href: string) => `${href}&skin=${skin}`;

  return (
    <div className="mx-auto max-w-[460px]">
      <BackButton href="/solo" label="Solo" />
      <div className="mt-5 flex items-end gap-2">
        <div className="min-w-0 flex-1 pb-3">
          <h1 className="display text-[2.2rem] leading-none">Okada Rush</h1>
          <p className="mt-1.5 text-muted">Carry Lagos to work, one route at a time.</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- local art, already sized */}
        <img src={`${ART}hero.webp`} alt="" className="-mb-2 h-[150px] w-auto shrink-0 drop-shadow-[0_10px_14px_rgba(28,20,22,.35)]" />
      </div>

      {/* Rank */}
      <section aria-labelledby="ok-rank-h" className="mt-5 rounded-[20px] bg-[#1f1b1d] px-4 py-3.5 text-white">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- local art, already sized */}
          <img src={`${ART}badge-${rank.index + 1}.webp`} alt="" className="h-14 w-14 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="text-[0.75rem] text-[#cfc6bf]">Your rank</span>
            <b id="ok-rank-h" className="display block text-[1.35rem] leading-tight">
              {rank.name}
            </b>
          </span>
          <span className="text-right text-[0.8rem] text-[#cfc6bf]">
            <b className="block text-[1.05rem] text-white">{career.km.toLocaleString("en-NG")} km</b>
            ridden
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-[#f2b705]" style={{ width: `${toNext * 100}%` }} />
        </div>
        <p className="mt-1.5 text-[0.75rem] text-[#cfc6bf]">{rank.next ? `${Math.max(0, Math.round((rank.next.km - career.km) * 10) / 10)} km more to ${rank.next.name}.` : "The top of the park. Every rider knows your name."}</p>
        <ol className="mt-2 flex justify-between text-[0.6rem] font-bold text-[#8f8580]" aria-label="Ranks">
          {RANKS.map((r, i) => (
            <li key={r.name} className={cn("flex flex-col items-center gap-0.5", i <= rank.index && "text-[#f2b705]")}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local art, already sized */}
              <img src={`${ART}badge-${i + 1}.webp`} alt="" className={cn("h-7 w-7", i > rank.index && "opacity-35 grayscale")} />
              {r.name}
            </li>
          ))}
        </ol>
      </section>

      {/* Routes */}
      <section aria-labelledby="ok-routes-h" className="mt-6">
        <div className="flex items-baseline justify-between px-0.5">
          <h2 id="ok-routes-h" className="display text-[1.35rem]">
            Routes
          </h2>
          <span className="text-[0.8rem] font-semibold text-muted">{career.routeStars.reduce((a, b) => a + b, 0)} of 15 ★</span>
        </div>
        <ol className="mt-2 flex flex-col gap-2">
          {ROUTES.map((name, i) => {
            const n = i + 1;
            const isOpen = open(n);
            const st = career.routeStars[i]!;
            const body = (
              <>
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-[1.1rem] font-black", isOpen ? "bg-[#f2b705] text-[#1f1b1d]" : "bg-[rgba(28,20,22,.12)] text-muted")}>{isOpen ? n : <Icon name="lock" size={15} />}</span>
                <span className="min-w-0 flex-1">
                  <b className="display block text-[1.05rem] leading-tight">{name}</b>
                  <span className="block text-[0.75rem] leading-snug text-muted">{isOpen ? ROUTE_ABOUT[i] : career.locked ? "Comes with Amah Plus." : `Get a star on ${ROUTES[i - 1]} first.`}</span>
                </span>
                {isOpen ? (
                  <span className="shrink-0 text-right">
                    <span className="block text-[0.85rem] tracking-[-0.05em] text-[#e3a417]">
                      {"★".repeat(st)}
                      <span className="text-[#d8cfc4]">{"★".repeat(3 - st)}</span>
                    </span>
                    <span className="text-[0.7rem] font-bold text-[#2e7d32]">{career.routeBest[i] != null ? naira(career.routeBest[i]!) : n === next ? "Ride now" : ""}</span>
                  </span>
                ) : null}
              </>
            );
            return (
              <li key={name}>
                {isOpen ? (
                  <Link prefetch={false} href={withSkin(`/solo/okada-rush?mode=route-${n}`)} className={cn("glass flex items-center gap-3 rounded-[18px] px-3.5 py-3", n === next && "outline outline-[3px] outline-offset-0 outline-[#f2b705]")}>
                    {body}
                  </Link>
                ) : (
                  <span className="flex items-center gap-3 rounded-[18px] bg-[rgba(28,20,22,.05)] px-3.5 py-3 opacity-80">{body}</span>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {career.locked ? <OkadaPlus left={career.trialLeft} resetsAt={career.resetsAt} /> : null}

      {/* Free Ride */}
      <section aria-labelledby="ok-free-h" className={cn("mt-6", career.locked && "hidden")}>
        <Link prefetch={false} href={withSkin("/solo/okada-rush?mode=free")} className="flex items-center justify-between gap-3 rounded-[20px] bg-[#4a4144] px-4 py-3.5 text-white">
          <span>
            <b id="ok-free-h" className="display block text-[1.3rem] leading-tight">
              Free Ride
            </b>
            <span className="text-[0.8rem] opacity-90">No end, busier and busier. Same bike for everyone: {career.freeBest != null ? `your best is ${naira(career.freeBest)}.` : "set your first score."}</span>
          </span>
          <span className="shrink-0 rounded-full bg-[#f2b705] px-4 py-2 font-extrabold text-[#1f1b1d]">Ride</span>
        </Link>
      </section>

      {/* Garage */}
      <section aria-labelledby="ok-garage-h" className="mt-7">
        <div className="flex items-baseline justify-between px-0.5">
          <h2 id="ok-garage-h" className="display text-[1.35rem]">
            Garage
          </h2>
          <span className="text-[0.8rem] font-semibold text-muted">Gear helps on the routes</span>
        </div>
        <div className="mt-2 flex items-center justify-between rounded-[20px] bg-[#1f1b1d] px-4 py-3.5 text-white">
          <span>
            <span className="text-[0.8rem] text-[#cfc6bf]">Your savings</span>
            <b className="display block text-[1.7rem] leading-tight text-[#f2b705]">{naira(savings)}</b>
          </span>
          <span className="text-right text-[0.78rem] text-[#cfc6bf]">
            Every fare and tip
            <br />
            goes here.
          </span>
        </div>
        <ul className="mt-2.5 grid grid-cols-2 gap-2">
          {GEAR.map((g) => {
            const have = gear.includes(g.id);
            const afford = savings >= g.price;
            return (
              <li key={g.id} className="glass relative flex flex-col rounded-[18px] px-3 py-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element -- local art, already sized */}
                <img src={`${ART}g-${g.id}.webp`} alt="" className="mx-auto mb-1 h-[52px] w-auto object-contain" />
                <b className="display text-[0.95rem] leading-tight">{g.name}</b>
                <span className="mt-0.5 min-h-[2.4em] text-[0.72rem] leading-snug text-muted">{g.about}</span>
                {have ? (
                  <span className="mt-1.5 rounded-full bg-[rgba(46,155,87,.14)] py-1.5 text-center text-[0.75rem] font-extrabold text-[#2e7d32]">On your okada</span>
                ) : (
                  <button type="button" disabled={!afford || buying !== null} onClick={() => void buy(g.id as GearId)} aria-label={`Buy ${g.name} for ${naira(g.price)}`} className={cn("mt-1.5 rounded-full py-1.5 text-[0.8rem] font-extrabold", afford ? "bg-[#1f1b1d] text-white" : "bg-[#eadfd2] text-[#9a8a7e]")}>
                    {buying === g.id ? "Buying…" : naira(g.price)}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <h3 className="mb-2 ml-1 mt-4 text-[0.8rem] font-extrabold text-muted">Bike colour</h3>
        <ul className="grid grid-cols-3 gap-2">
          {SKINS.map((k) => {
            const have = skins.includes(k.id);
            const on = skin === k.id;
            return (
              <li key={k.id}>
                <button
                  type="button"
                  disabled={buying !== null || (!have && savings < k.price)}
                  onClick={() => (have ? pick(k.id) : void buy(k.id))}
                  aria-pressed={have ? on : undefined}
                  aria-label={have ? `Ride the ${k.name.toLowerCase()} okada` : `Buy ${k.name.toLowerCase()} for ${naira(k.price)}`}
                  className={cn("glass flex w-full flex-col items-center rounded-[16px] border-2 px-2 py-2.5", on ? "border-[#f2b705]" : "border-transparent", !have && savings < k.price && "opacity-60")}
                >
                  <span aria-hidden className="h-7 w-7 rounded-full border-2 border-[#1c1416]" style={{ background: SKIN_COLOUR[k.id] }} />
                  <span className="mt-1 text-[0.75rem] font-bold">{k.name}</span>
                  <span className="text-[0.68rem] font-extrabold text-[#2e7d32]">{have ? (on ? "Riding" : "Yours") : naira(k.price)}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-center text-[0.75rem] text-muted">Free Ride is the same bike for everyone, so its leaderboard stays fair. Colours show everywhere.</p>
      </section>
    </div>
  );
}

/** Without Plus: Yaba streets twice a day, and what the rest of Okada Rush holds. */
function OkadaPlus({ left, resetsAt }: { left: number; resetsAt: string }) {
  const { plusHref } = useSoloLimits();
  return (
    <div className="cloth mt-4 px-4 py-3.5 text-center">
      <p className="font-bold">
        {left > 0 ? `Yaba streets is free: ${left === 1 ? "1 ride" : `${left} rides`} left today.` : "That's today's free rides on Yaba streets."}
      </p>
      {left > 0 ? null : (
        <p className="text-[0.88rem] text-muted" suppressHydrationWarning>
          They&apos;re back {untilText(resetsAt)}.
        </p>
      )}
      <p className="mt-1 text-[0.88rem] text-muted">The other routes and Free Ride come with Amah Plus.</p>
      {plusHref ? (
        <Link prefetch={false} href={plusHref} className="mt-2.5 inline-flex h-11 items-center rounded-full bg-[#1c1416] px-5 font-extrabold text-[#f6efe6]">
          Try Amah Plus
        </Link>
      ) : null}
    </div>
  );
}
