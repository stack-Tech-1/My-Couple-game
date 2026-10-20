"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Button } from "@/design/Button";
import { TextField } from "@/design/Field";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { addContent, setContentHidden } from "@/lib/admin/content-actions";
import type { ContentKind } from "@/lib/content/catalog";

export type Row = { key: string; text: string; added: boolean; hidden: boolean; heat?: number };

// Kept here (not imported from the catalog) so the admin bundle doesn't ship every deck.
const DEEP_LEVELS = ["Warm-up", "Getting real", "The deep end"];
const HEAT = { 1: "Warm", 2: "Hot", 3: "Fire" } as Record<number, string>;
const select = "h-12 w-full rounded-[var(--radius)] border-[1.5px] border-line bg-raised px-3 text-[1rem]";

function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[0.82rem] font-semibold">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={select}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function AddForm({ kind, onDone }: { kind: ContentKind; onDone: () => void }) {
  const [f, setF] = useState<Record<string, string>>({ level: "0", heat: "1", where: "home", budget: "0" });
  const [pending, start] = useTransition();
  const set = (k: string) => (v: string) => setF((cur) => ({ ...cur, [k]: v }));
  const text = (k: string, label: string, max: number, placeholder?: string) => (
    <TextField label={label} value={f[k] ?? ""} onChange={(e) => set(k)(e.target.value)} maxLength={max} placeholder={placeholder} required />
  );

  let fields: ReactNode;
  let body: () => unknown;
  switch (kind) {
    case "daily_question":
    case "story_opener":
      fields = text("text", kind === "story_opener" ? "Opening line" : "Question", 200);
      body = () => ({ text: f.text });
      break;
    case "date_idea":
      fields = (
        <>
          {text("title", "Title", 60, "Sunset picnic")}
          {text("detail", "Details", 200, "A blanket, a flask and the best view you can reach.")}
          <div className="grid grid-cols-2 gap-3">
            <Choice label="Where" value={f.where!} onChange={set("where")} options={[["home", "At home"], ["out", "Going out"], ["distance", "Long distance"]]} />
            <Choice label="Budget" value={f.budget!} onChange={set("budget")} options={[["0", "Free"], ["1", "A little"], ["2", "A treat"]]} />
          </div>
        </>
      );
      body = () => ({ title: f.title, detail: f.detail, where: f.where, budget: Number(f.budget) });
      break;
    case "this_or_that":
      fields = (
        <div className="grid grid-cols-2 gap-3">
          {text("a", "This", 60, "Sunrise")}
          {text("b", "Or that", 60, "Sunset")}
        </div>
      );
      body = () => ({ a: f.a, b: f.b });
      break;
    case "how_well":
      fields = (
        <>
          {text("q", "Question", 100, "Ideal Sunday?")}
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <TextField key={i} label={`Answer ${i + 1}`} value={f[`o${i}`] ?? ""} onChange={(e) => set(`o${i}`)(e.target.value)} maxLength={60} required />
            ))}
          </div>
        </>
      );
      body = () => ({ q: f.q, options: [f.o0, f.o1, f.o2, f.o3] });
      break;
    case "deep_question":
      fields = (
        <>
          <Choice label="Level" value={f.level!} onChange={set("level")} options={DEEP_LEVELS.map((l, i) => [String(i), l])} />
          {text("text", "Question", 200)}
        </>
      );
      body = () => ({ level: Number(f.level), text: f.text });
      break;
    default:
      fields = (
        <>
          {text("text", "Card", 200)}
          <Choice label="Heat" value={f.heat!} onChange={set("heat")} options={[["1", "Warm"], ["2", "Hot"], ["3", "Fire"]]} />
        </>
      );
      body = () => ({ text: f.text, heat: Number(f.heat) });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await addContent(kind, body());
      if (!res.ok) return void toast.error(res.error);
      toast.success("Added.");
      setF({ level: f.level!, heat: f.heat!, where: f.where!, budget: f.budget! });
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="rounded-[18px] border border-line bg-raised p-5">
      <h2 className="text-[0.95rem] font-semibold">Add one</h2>
      <div className="mt-4 flex flex-col gap-4">{fields}</div>
      <div className="mt-5 flex justify-end">
        <Button type="submit" loading={pending}>
          Add
        </Button>
      </div>
    </form>
  );
}

export function ContentEditor({ kind, label, usedIn, daily, rows }: { kind: ContentKind; label: string; usedIn: string; daily: boolean; rows: Row[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "added" | "hidden">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => (filter === "all" || (filter === "added" ? r.added : r.hidden)) && (!needle || r.text.toLowerCase().includes(needle)));
  }, [rows, q, filter]);
  const live = rows.filter((r) => !r.hidden).length;

  function toggle(r: Row) {
    setBusy(r.key);
    start(async () => {
      const res = await setContentHidden(kind, r.key, !r.hidden);
      setBusy(null);
      if (!res.ok) return void toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <div className="min-w-0">
      <h2 className="display text-[1.9rem] leading-tight">{label}</h2>
      <p className="mt-1 text-[0.88rem] text-muted">
        {usedIn} {live} in use.
        {daily ? " Changes here start tomorrow (UTC), so nobody's question changes halfway through a day." : ""}
      </p>

      <div className="mt-5">
        <AddForm kind={kind} onDone={() => router.refresh()} />
      </div>

      <div className="mt-8 flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1">
          <TextField label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a card" />
        </div>
        <div className="flex rounded-full border border-line bg-raised p-1" role="group" aria-label="Show">
          {(["all", "added", "hidden"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={cn("rounded-full px-3 py-1.5 text-[0.82rem] font-semibold capitalize", filter === k ? "bg-fg text-bg" : "text-muted hover:text-fg")}>
              {k === "added" ? "Yours" : k}
            </button>
          ))}
        </div>
      </div>

      <ul aria-label={`${label} list`} className="mt-4 divide-y divide-line rounded-[18px] border border-line bg-raised">
        {shown.map((r) => (
          <li key={r.key} className="flex items-start gap-3 px-4 py-3">
            <div className={cn("min-w-0 flex-1 text-[0.92rem]", r.hidden && "text-muted line-through decoration-1")}>
              {r.text}
              <span className="ml-2 inline-flex gap-1.5 align-middle">
                {r.added ? <span className="rounded-full bg-sunk px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide no-underline">Yours</span> : null}
                {r.heat ? <span className="rounded-full border border-line px-2 py-0.5 text-[0.68rem] font-semibold">{HEAT[r.heat]}</span> : null}
              </span>
            </div>
            <Button variant={r.hidden ? "outline" : "ghost"} size="sm" onClick={() => toggle(r)} loading={busy === r.key} aria-label={`${r.hidden ? "Show" : r.added ? "Remove" : "Hide"}: ${r.text}`}>
              {r.hidden ? "Show" : r.added ? "Remove" : "Hide"}
            </Button>
          </li>
        ))}
        {!shown.length ? <li className="px-4 py-8 text-center text-muted">Nothing matches.</li> : null}
      </ul>
    </div>
  );
}
