"use client";

import { useState, useTransition } from "react";
import { Button } from "@/design/Button";
import { TextField, Toggle } from "@/design/Field";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { saveTicker } from "@/lib/admin/actions";
import { soloGame } from "@/lib/solo/catalog";
import { TICKER_GAMES, TICKER_MAX, type TickerConfig } from "@/lib/engage/ticker";

/** The news strip under each page's title: a message, the weekly winners, the week's best scores. */
export function TickerEditor({ initial, preview }: { initial: TickerConfig; preview: string[] }) {
  const [message, setMessage] = useState(initial.message);
  const [winners, setWinners] = useState(initial.winners);
  const [games, setGames] = useState<string[]>(initial.games);
  const [pending, start] = useTransition();

  const flip = (id: string) => setGames((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));
  const save = () =>
    start(async () => {
      const r = await saveTicker({ message, winners, games });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Saved. The strip shows it within a minute.");
    });

  return (
    <section aria-labelledby="ticker-h" className="cloth mt-8 p-5">
      <h2 id="ticker-h" className="display text-[1.6rem] leading-none">Ticker</h2>
      <p className="mt-1.5 text-[0.88rem] text-muted">What runs along the strip under each page&apos;s title, for everyone inside the app. With nothing to say, the strip shows the page&apos;s own words.</p>
      <div className="mt-4">
        <TextField label="Your message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={TICKER_MAX} placeholder="New this week: Okada Rush has a throttle" />
        <p className="mt-1 text-[0.78rem] text-muted">{message.length}/{TICKER_MAX}. Shown first. Leave it empty for none.</p>
      </div>
      <div className="mt-3 border-t border-line">
        <Toggle checked={winners} onChange={setWinners} label="Weekly winners" description="Couple of the Week and Gang of the Week, once they've said yes." />
      </div>
      <p className="mt-3 text-[0.82rem] font-semibold">This week&apos;s best in…</p>
      <p className="text-[0.78rem] text-muted">The top Solo score since Monday, first name only.</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {TICKER_GAMES.map((g) => {
          const on = games.includes(g.id);
          return (
            <button key={g.id} type="button" aria-pressed={on} onClick={() => flip(g.id)} className={cn("rounded-full border-[1.5px] px-3 py-1 text-[0.82rem] font-bold", on ? "border-fg bg-fg text-bg" : "border-line")}>
              {soloGame(g.id)?.name ?? g.id}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button loading={pending} onClick={save}>Save</Button>
      </div>
      <div className="mt-5">
        <p className="text-[0.82rem] font-semibold">Running now</p>
        <div className="selvedge mt-1.5">
          <span className="inline-block pl-3.5">{preview.length ? preview.join(" · ") : "Nothing set: pages show their own words."}</span>
        </div>
      </div>
    </section>
  );
}
