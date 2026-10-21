"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/Button";
import { Confetti } from "@/design/Confetti";
import { Icon } from "@/design/icons";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { addBucketItem, deleteBucketItem, setBucketDone } from "@/lib/romantic/actions";
import type { BucketCategory, BucketItem } from "@/lib/romantic/types";
import { playSound } from "@/lib/sound";

const CATS: { key: BucketCategory; label: string }[] = [
  { key: "adventure", label: "Adventure" },
  { key: "travel", label: "Travel" },
  { key: "home", label: "At home" },
  { key: "food", label: "Food" },
  { key: "learn", label: "Learn" },
  { key: "someday", label: "Someday" },
];

export function BucketList({ items }: { items: BucketItem[] }) {
  const { bundle, send, on } = useRoom();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [cat, setCat] = useState<BucketCategory>("adventure");
  const [pending, start] = useTransition();
  const [party, setParty] = useState(0);
  const todo = items.filter((i) => !i.done_at);
  const done = items.filter((i) => i.done_at);
  const nameOf = (id: string | null) => (id === bundle.me.profile.id ? "you" : id === bundle.partner?.profile.id ? bundle.partner.profile.display_name : "someone");

  useEffect(() => on("bucket:changed", () => router.refresh()), [on, router]);
  const changed = () => {
    send("bucket:changed", {});
    router.refresh();
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await addBucketItem({ title, category: cat });
      if (!r.ok) return void toast.error(r.error);
      setTitle("");
      changed();
    });
  };

  const toggle = (item: BucketItem) => {
    const nowDone = !item.done_at;
    if (nowDone) {
      setParty((n) => n + 1);
      if (bundle.me.member.sound_enabled) playSound("win");
    }
    void setBucketDone(item.id, nowDone).then((r) => (r.ok ? changed() : toast.error(r.error)));
  };

  return (
    <div className="flex flex-col gap-7">
      {party ? <Confetti key={party} /> : null}
      <p className="display text-[1.4rem]">
        <span className="tabular">{done.length}</span> done · <span className="tabular">{todo.length}</span> to go
      </p>

      <form onSubmit={add} className="flex flex-col gap-3 rounded-[18px] border-[1.5px] border-line-strong bg-raised p-4">
        <div className="flex gap-2">
          <label htmlFor="bucket-title" className="sr-only">
            Something to do together
          </label>
          <input id="bucket-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Watch the sunset at Bower's Tower, Ibadan…" className="h-12 min-w-0 flex-1 rounded-full border-[1.5px] border-line bg-bg px-5 focus:border-line-strong focus:outline-none" />
          <Button type="submit" variant="accent" loading={pending} disabled={!title.trim()}>
            Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Category">
          {CATS.map((c) => (
            <button key={c.key} type="button" role="radio" aria-checked={cat === c.key} onClick={() => setCat(c.key)} className={cn("rounded-full border px-3 py-1 text-[0.8rem]", cat === c.key ? "border-line-strong bg-fg text-bg" : "border-line")}>
              {c.label}
            </button>
          ))}
        </div>
      </form>

      {todo.length === 0 && done.length === 0 ? <p className="text-center text-muted">Empty for now. Every couple has a list; yours just isn&apos;t written down yet.</p> : null}

      <ul className="flex flex-col gap-2" aria-label="To do">
        <AnimatePresence initial={false}>
          {todo.map((i) => (
            <Row key={i.id} item={i} onToggle={() => toggle(i)} onDelete={() => void deleteBucketItem(i.id).then((r) => (r.ok ? changed() : toast.error(r.error)))} sub={`${CATS.find((c) => c.key === i.category)?.label} · added by ${nameOf(i.created_by)}`} />
          ))}
        </AnimatePresence>
      </ul>

      {done.length ? (
        <div>
          <p className="eyebrow mb-3 text-muted">Done together</p>
          <ul className="flex flex-col gap-2" aria-label="Done">
            {done.map((i) => (
              <Row key={i.id} item={i} onToggle={() => toggle(i)} sub={`Ticked off by ${nameOf(i.done_by)} · ${new Date(i.done_at!).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Row({ item, onToggle, onDelete, sub }: { item: BucketItem; onToggle: () => void; onDelete?: () => void; sub: string }) {
  const done = !!item.done_at;
  return (
    <motion.li layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 30 }} className={cn("flex items-center gap-3 rounded-[14px] border px-4 py-3", done ? "border-line bg-sunk" : "border-line bg-raised")}>
      <button type="button" role="checkbox" aria-checked={done} aria-label={`${done ? "Undo" : "Done"}: ${item.title}`} onClick={onToggle} className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors", done ? "border-[#5f7a4f] bg-[#5f7a4f] text-white" : "border-line-strong hover:bg-sunk")}>
        {done ? <Icon name="check" size={16} strokeWidth={2.4} /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("font-semibold", done && "text-muted line-through decoration-2")}>{item.title}</p>
        {item.note ? <p className="line-clamp-1 text-[0.85rem] text-muted">{item.note}</p> : null}
        <p className="text-[0.75rem] text-muted">{sub}</p>
      </div>
      {onDelete ? (
        <button type="button" aria-label={`Remove ${item.title}`} onClick={onDelete} className="rounded-full p-1.5 text-muted hover:bg-sunk hover:text-fg">
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </motion.li>
  );
}