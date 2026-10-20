"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Tabs } from "@/design/Tabs";
import { Icon } from "@/design/icons";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { setFantasyPick } from "@/lib/afterdark/actions";
import type { FantasyState } from "@/lib/afterdark/server";
import { FANTASY, FANTASY_GROUPS } from "@/content/after-dark";

type Pick = "yes" | "maybe" | "no";
const PICKS: { key: Pick; label: string }[] = [
  { key: "yes", label: "Yes" },
  { key: "maybe", label: "Maybe" },
  { key: "no", label: "No" },
];

/**
 * Your answers are yours alone: the database won't let anyone else read them. The only thing
 * ever shared is the list of mutual matches, so a "No" can never be seen.
 */
export function FantasyMatch({ initial }: { initial: FantasyState }) {
  const { bundle } = useRoom();
  const [picks, setPicks] = useState(initial.picks);
  const [matches, setMatches] = useState(initial.matches);
  const [tab, setTab] = useState<"choose" | "matches">("choose");
  const partnerName = bundle.partner?.profile.display_name ?? "your partner";
  const answered = Object.keys(picks).length;
  const matchSet = useMemo(() => new Set(matches), [matches]);

  const choose = (id: string, p: Pick) => {
    const next = picks[id] === p ? null : p;
    setPicks((all) => {
      const copy = { ...all };
      if (next) copy[id] = next;
      else delete copy[id];
      return copy;
    });
    void setFantasyPick(id, next).then((r) => {
      if (r.ok) setMatches(r.data);
      else toast.error(r.error);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[0.92rem] text-muted">
        You&apos;ve answered {answered} of {FANTASY.length}. {partnerName[0]!.toUpperCase() + partnerName.slice(1)} has answered {initial.progress.partner}. Nobody ever sees anyone&apos;s answers, only what you both said yes to.
      </p>
      <Tabs
        label="Fantasy Match"
        value={tab}
        onChange={setTab}
        items={[
          { key: "choose", label: "Your answers" },
          { key: "matches", label: <>Matches{matches.length ? <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[0.72rem] text-on-accent">{matches.length}</span> : null}</> },
        ]}
      />

      {tab === "choose" ? (
        <div className="flex flex-col gap-8">
          {FANTASY_GROUPS.map((g) => (
            <section key={g} aria-labelledby={`fg-${g}`}>
              <h2 id={`fg-${g}`} className="display mb-3 text-[1.5rem]">
                {g}
              </h2>
              <ul className="flex flex-col gap-2">
                {FANTASY.filter((f) => f.group === g).map((f) => (
                  <li key={f.id} className="flex flex-col gap-2 rounded-[14px] border border-line bg-raised px-4 py-3 @lg:flex-row @lg:items-center @lg:justify-between">
                    <span className="flex items-center gap-2">
                      {matchSet.has(f.id) ? <Icon name="heart" size={16} className="shrink-0 text-accent" fill="currentColor" aria-label="A match" /> : null}
                      {f.text}
                    </span>
                    <div className="flex shrink-0 gap-1.5" role="radiogroup" aria-label={f.text}>
                      {PICKS.map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          role="radio"
                          aria-checked={picks[f.id] === p.key}
                          onClick={() => choose(f.id, p.key)}
                          className={cn(
                            "min-w-16 rounded-full border-[1.5px] px-3 py-1.5 text-[0.85rem] font-semibold transition-colors",
                            picks[f.id] === p.key ? (p.key === "yes" ? "border-accent bg-accent text-on-accent" : p.key === "maybe" ? "border-brass bg-brass text-ink" : "border-line-strong bg-fg text-bg") : "border-line",
                          )}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : matches.length ? (
        <ul className="grid gap-3 @lg:grid-cols-2">
          <AnimatePresence>
            {FANTASY.filter((f) => matchSet.has(f.id)).map((f, i) => (
              <motion.li key={f.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.04 }} className="rounded-[18px] border-[1.5px] border-accent bg-raised p-5" style={{ boxShadow: "0 0 40px -18px var(--accent)" }}>
                <p className="eyebrow text-accent-ink">{f.group}</p>
                <p className="display mt-2 text-[1.4rem] leading-snug">{f.text}</p>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <p className="py-10 text-center text-muted">No matches yet. Keep answering; anything you both say yes to will appear here, and nothing else ever will.</p>
      )}
    </div>
  );
}
