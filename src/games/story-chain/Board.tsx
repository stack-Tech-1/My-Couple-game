"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { GameProps } from "@/games/_engine/types";
import { Button } from "@/design/Button";
import { Modal } from "@/design/Modal";
import { TextField } from "@/design/Field";
import { toast } from "@/design/toast";
import { Status } from "@/games/_ui";
import type { StoryMove, StoryView } from "./logic";
import { renderStoryCard } from "./card";

export function StoryChainBoard({ view, me, names, sendMove, pending, sound }: GameProps<StoryView, StoryMove>) {
  const [line, setLine] = useState("");
  const [ending, setEnding] = useState(false);
  const [title, setTitle] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const partner = view.players[0] === me ? view.players[1] : view.players[0];
  const partnerName = names[partner] ?? "Your partner";
  const myTurn = view.players[view.turn] === me && !view.ended;

  // Braces matter: newer browsers return a Promise from scrollIntoView, and an effect must not return one.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [view.lines.length]);

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!line.trim()) return;
    sound("tap");
    void sendMove({ type: "line", text: line.trim() }).then(() => setLine(""), () => {});
  };

  const share = async () => {
    try {
      const blob = await renderStoryCard({
        title: view.title ?? "Untitled, but iconic",
        opener: view.opener,
        lines: view.lines.map((l) => ({ text: l.text, mine: l.by === me })),
        names: [names[me] ?? "You", partnerName],
      });
      const file = new File([blob], "our-story.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: view.title ?? "Our story" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "our-story.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Couldn't make the card.", "Try again in a moment.");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
      <article className="rounded-[6px] border border-line bg-[#fbf7f1] px-6 py-8 text-ink shadow-[0_20px_40px_-30px_rgba(28,20,22,.6)] sm:px-10" aria-label="The story so far">
        {view.title ? <h2 className="display mb-5 text-[2.2rem]">{view.title}</h2> : null}
        <p className="display text-[1.3rem] italic leading-relaxed text-[#57474a]">{view.opener}</p>
        <AnimatePresence initial={false}>
          {view.lines.map((l, i) => (
            <motion.p key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="display mt-3 border-l-[3px] pl-4 text-[1.3rem] leading-relaxed" style={{ borderColor: l.by === me ? "#e8563a" : "#5b1a2b", color: l.by === me ? "#1c1416" : "#5b1a2b" }}>
              <span className="sr-only">{l.by === me ? "You" : partnerName}: </span>
              {l.text}
            </motion.p>
          ))}
        </AnimatePresence>
        {view.ended ? <p className="display mt-6 text-center text-[1.1rem] italic text-[#57474a]">The End.</p> : null}
        <div ref={end} />
      </article>

      {view.ended ? (
        <div className="flex flex-col items-center gap-3">
          <Status>A masterpiece, probably.</Status>
          <Button variant="accent" icon="camera" onClick={share}>
            Save as a card
          </Button>
        </div>
      ) : (
        <>
          <Status>{myTurn ? "Your line." : `${partnerName} is writing…`}</Status>
          {myTurn ? (
            <form onSubmit={add} className="flex flex-col gap-3">
              <label htmlFor="story-line" className="sr-only">
                Your line
              </label>
              <textarea
                id="story-line"
                value={line}
                onChange={(e) => setLine(e.target.value)}
                maxLength={220}
                rows={2}
                placeholder="And then…"
                className="w-full rounded-[16px] border-[1.5px] border-line bg-raised px-5 py-3 text-[1.05rem] focus:border-line-strong focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    (e.currentTarget.form as HTMLFormElement).requestSubmit();
                  }
                }}
              />
              <Button type="submit" loading={pending} disabled={!line.trim()}>
                Add my line
              </Button>
            </form>
          ) : null}
          <p className="text-center text-[0.85rem] text-muted">
            {view.lines.length} of {view.maxLines} lines
            {view.lines.length >= view.minLinesToEnd ? (
              <>
                {" · "}
                <button type="button" className="font-semibold text-fg underline underline-offset-2" onClick={() => setEnding(true)}>
                  Write “The End”
                </button>
              </>
            ) : null}
          </p>
        </>
      )}

      <Modal open={ending} onClose={() => setEnding(false)} title="The End?" description="Give your story a title. Or don't. Untitled is very arty.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setEnding(false);
            void sendMove({ type: "end", ...(title.trim() ? { title: title.trim() } : {}) });
          }}
          className="flex flex-col gap-4"
        >
          <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="The Goat Who Would Be Mayor" />
          <Button type="submit" variant="accent">
            Finish the story
          </Button>
        </form>
      </Modal>
    </div>
  );
}