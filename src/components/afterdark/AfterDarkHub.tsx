"use client";

import Link from "next/link";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/Button";
import { Toggle } from "@/design/Field";
import { Icon } from "@/design/icons";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { useGameFlags } from "@/lib/games/FlagsProvider";
import { addCustomCard, deleteCustomCard, setAgeConfirmed, setMatchMode, setMaxHeat, setOptIn } from "@/lib/afterdark/actions";
import type { AfterDarkState } from "@/lib/afterdark/server";
import { gamesIn } from "@/games/catalog";
import { GameArt } from "@/games/GameArt";
import { HEAT_LABEL, type Heat } from "@/content/after-dark";

const DECKS = [
  ["truth", "Truth"],
  ["dare", "Dare"],
  ["hotseat", "Hot Seat"],
  ["never", "Never Have I Ever"],
  ["dice_action", "Dice: what"],
  ["dice_where", "Dice: where/how"],
] as const;

export function AfterDarkHub({ state: server }: { state: AfterDarkState }) {
  const { bundle } = useRoom();
  const { isOff } = useGameFlags();
  const router = useRouter();
  const [, start] = useTransition();
  const partnerName = bundle.partner?.profile.display_name ?? "your partner";

  // Optimistic: controls respond instantly, then reconcile with the server (or revert on error).
  const [me, setMe] = useState(server.me);
  useEffect(() => setMe(server.me), [server.me]);
  const state = { ...server, me };
  const run = (patch: Partial<AfterDarkState["me"]>, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setMe((m) => ({ ...m, ...patch }));
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        toast.error(r.error ?? "That didn't work.");
        setMe(server.me);
      }
      router.refresh();
    });
  };

  return (
    <div className="relative z-[1] mx-auto max-w-3xl pt-8">
      <Link href={`/room/${bundle.room.id}`} className="inline-flex items-center gap-1.5 text-[0.9rem] font-semibold text-muted hover:text-fg">
        <Icon name="arrowLeft" size={16} /> Room
      </Link>
      <p className="eyebrow mt-8 text-accent-ink">After dark · 18+</p>
      <h1 className="display mt-3 text-[clamp(2.8rem,9vw,4.4rem)]">{state.unlocked ? "The lights are low." : "Two keys, two yeses."}</h1>
      <p className="mt-3 max-w-xl text-[1.05rem] leading-relaxed text-muted">
        {state.unlocked
          ? `Flirty, teasing, never graphic. Heat is capped at ${HEAT_LABEL[state.effectiveHeat as Heat]}: the lower of your two limits. Skip anything, any time.`
          : "This corner opens only when you've both confirmed you're 18 or older and both chosen to open it, each on your own phone. Either of you can close it again at any time."}
      </p>

      {state.unlocked ? (
        <section aria-label="Games" className="mt-10 grid grid-cols-2 gap-3 @2xl:grid-cols-3">
          {gamesIn("spicy").filter((g) => !isOff(g.id)).map((g) => (
            <Link key={g.id} href={`/room/${bundle.room.id}/games/${g.id}`} className="group flex flex-col rounded-[18px] border border-line bg-raised p-4 transition-colors hover:border-line-strong">
              <GameArt id={g.id} accent="var(--accent)" className="mx-auto h-20 w-auto text-fg" />
              <p className="mt-3 font-bold leading-tight">{g.name}</p>
              <p className="mt-1 text-[0.82rem] text-muted">{g.tagline}</p>
            </Link>
          ))}
        </section>
      ) : null}

      <section aria-labelledby="keys-h" className="mt-12 border-t-[1.5px] border-line-strong pt-5">
        <h2 id="keys-h" className="eyebrow mb-4 text-muted">
          Your key
        </h2>
        <div className="divide-y divide-line rounded-[18px] border border-line bg-raised px-5">
          <label className="flex cursor-pointer items-start gap-4 py-4">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--accent)]" checked={state.me.ageConfirmed} onChange={(e) => { const v = e.target.checked; run(v ? { ageConfirmed: true } : { ageConfirmed: false, optIn: false }, () => setAgeConfirmed(v)); }} />
            <span>
              <span className="block font-semibold">I confirm I&apos;m 18 or older</span>
              <span className="text-[0.85rem] text-muted">We only store that you confirmed, and when. Unticking also closes After Dark.</span>
            </span>
          </label>
          <Toggle
            label="Open After Dark from my side"
            description={
              state.unlocked
                ? "Open for you both. Switch off to close it for both of you, instantly."
                : state.me.optIn
                  ? `You've said yes. It opens when ${partnerName} does too.`
                  : "Your yes is private until you've both said it."
            }
            checked={state.me.optIn}
            disabled={!state.me.ageConfirmed}
            onChange={(v) => run({ optIn: v }, () => setOptIn(v))}
          />
          <div className="py-4">
            <p className="font-semibold">My heat limit</p>
            <p className="text-[0.85rem] text-muted">Games use the lower of your two limits. You&apos;ll never be shown your partner&apos;s.</p>
            <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="My heat limit">
              {([1, 2, 3] as Heat[]).map((h) => (
                <button key={h} type="button" role="radio" aria-checked={state.me.maxHeat === h} onClick={() => run({ maxHeat: h }, () => setMaxHeat(h))} className={cn("rounded-[12px] border-[1.5px] py-3 font-semibold", state.me.maxHeat === h ? "border-accent bg-accent text-on-accent" : "border-line")}>
                  {HEAT_LABEL[h]}
                </button>
              ))}
            </div>
          </div>
          {state.unlocked ? (
            <Toggle
              label="Fantasy Match: reveal Yes + Maybe"
              description="Only applies if you both turn it on. Otherwise only mutual yeses are shown."
              checked={state.me.matchMode === "yes_maybe"}
              onChange={(v) => run({ matchMode: v ? "yes_maybe" : "yes" }, () => setMatchMode(v ? "yes_maybe" : "yes"))}
            />
          ) : null}
        </div>
      </section>

      {state.unlocked ? <CustomCards cards={state.customCards} me={bundle.me.profile.id} /> : null}
    </div>
  );
}

function CustomCards({ cards, me }: { cards: AfterDarkState["customCards"]; me: string }) {
  const router = useRouter();
  const [deck, setDeck] = useState<(typeof DECKS)[number][0]>("truth");
  const [heat, setHeat] = useState<Heat>(1);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  const add = (e: FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await addCustomCard({ deck, heat, text });
      if (!r.ok) return void toast.error(r.error);
      setText("");
      router.refresh();
    });
  };

  return (
    <section aria-labelledby="custom-h" className="mt-12 border-t-[1.5px] border-line-strong pt-5">
      <h2 id="custom-h" className="eyebrow mb-1 text-muted">
        Your own cards
      </h2>
      <p className="mb-4 text-[0.9rem] text-muted">Private to your room. They join the decks at their heat level.</p>
      <form onSubmit={add} className="flex flex-col gap-3 rounded-[18px] border border-line bg-raised p-4">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Deck">
          {DECKS.map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={deck === k} onClick={() => setDeck(k)} className={cn("rounded-full border px-3 py-1 text-[0.8rem]", deck === k ? "border-line-strong bg-fg text-bg" : "border-line")}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <label htmlFor="custom-text" className="sr-only">
            Card text
          </label>
          <input id="custom-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="Write your own…" className="h-11 min-w-0 flex-1 rounded-full border-[1.5px] border-line bg-bg px-4 focus:border-line-strong focus:outline-none" />
          <select aria-label="Heat" value={heat} onChange={(e) => setHeat(Number(e.target.value) as Heat)} className="h-11 rounded-full border-[1.5px] border-line bg-bg px-3 text-[0.85rem]">
            {([1, 2, 3] as Heat[]).map((h) => (
              <option key={h} value={h}>
                {HEAT_LABEL[h]}
              </option>
            ))}
          </select>
          <Button type="submit" loading={pending} disabled={text.trim().length < 2}>
            Add
          </Button>
        </div>
      </form>
      {cards.length ? (
        <ul className="mt-4 flex flex-col gap-2">
          {cards.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-[12px] border border-line px-4 py-2.5 text-[0.92rem]">
              <span className="eyebrow shrink-0 text-muted">{DECKS.find(([k]) => k === c.deck)?.[1]} · {HEAT_LABEL[c.heat as Heat]}</span>
              <span className="min-w-0 flex-1 truncate">{c.text}</span>
              {c.created_by === me ? (
                <button type="button" aria-label="Delete card" className="rounded-full p-1 text-muted hover:text-fg" onClick={() => void deleteCustomCard(c.id).then((r) => (r.ok ? router.refresh() : toast.error(r.error)))}>
                  <Icon name="close" size={14} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}