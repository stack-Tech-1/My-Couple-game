"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Button } from "@/design/Button";
import { TextField } from "@/design/Field";
import { toast } from "@/design/toast";
import { suggestCard } from "@/lib/feedback/actions";
import { SUGGEST_KINDS, type SuggestKind } from "@/lib/feedback/types";

const select = "h-12 w-full rounded-[var(--radius)] border-[1.5px] border-line bg-raised px-3 text-[1rem]";
const DEEP_LEVELS = ["Warm-up", "Getting real", "The deep end"];

function Pick({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
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

/** "Suggest a card": goes to the team for review, and may end up in everyone's decks. */
export function SuggestForm({ spicyOpen }: { spicyOpen: boolean }) {
  const kinds = SUGGEST_KINDS.filter((k) => spicyOpen || !k.spicy);
  const [kind, setKind] = useState<SuggestKind>("daily_question");
  const [f, setF] = useState<Record<string, string>>({ level: "0", heat: "1", where: "home", budget: "0" });
  const [pending, start] = useTransition();
  const set = (k: string) => (v: string) => setF((cur) => ({ ...cur, [k]: v }));
  const text = (k: string, label: string, max: number, placeholder?: string) => (
    <TextField label={label} value={f[k] ?? ""} onChange={(e) => set(k)(e.target.value)} maxLength={max} placeholder={placeholder} required />
  );

  let fields: ReactNode;
  let body: () => unknown;
  if (kind === "this_or_that") {
    fields = (
      <div className="grid grid-cols-2 gap-3">
        {text("a", "This", 60, "Jollof")}
        {text("b", "Or that", 60, "Fried rice")}
      </div>
    );
    body = () => ({ a: f.a, b: f.b });
  } else if (kind === "deep_question") {
    fields = (
      <>
        <Pick label="How deep?" value={f.level!} onChange={set("level")} options={DEEP_LEVELS.map((l, i) => [String(i), l])} />
        {text("text", "Question", 200)}
      </>
    );
    body = () => ({ level: Number(f.level), text: f.text });
  } else if (kind === "date_idea") {
    fields = (
      <>
        {text("title", "Title", 60, "Suya and a sunset")}
        {text("detail", "Details", 200)}
        <div className="grid grid-cols-2 gap-3">
          <Pick label="Where" value={f.where!} onChange={set("where")} options={[["home", "At home"], ["out", "Going out"], ["distance", "Long distance"]]} />
          <Pick label="Budget" value={f.budget!} onChange={set("budget")} options={[["0", "Free"], ["1", "A little"], ["2", "A treat"]]} />
        </div>
      </>
    );
    body = () => ({ title: f.title, detail: f.detail, where: f.where, budget: Number(f.budget) });
  } else if (kind === "truth" || kind === "dare" || kind === "never") {
    fields = (
      <>
        {text("text", kind === "never" ? "Never have I ever…" : "Card", 200)}
        <Pick label="Heat" value={f.heat!} onChange={set("heat")} options={[["1", "Warm"], ["2", "Hot"], ["3", "Fire"]]} />
      </>
    );
    body = () => ({ text: f.text, heat: Number(f.heat) });
  } else {
    fields = text("text", "Question", 200, "What's the most Naija thing about you?");
    body = () => ({ text: f.text });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await suggestCard(kind, body());
      if (!res.ok) return void toast.error(res.error);
      toast.success("Suggestion sent.", "If it makes the cut, everyone gets to play it.");
      setF({ level: f.level!, heat: f.heat!, where: f.where!, budget: f.budget! });
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Pick label="What kind of card?" value={kind} onChange={(v) => setKind(v as SuggestKind)} options={kinds.map((k) => [k.kind, k.label])} />
      {fields}
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Suggest it
        </Button>
      </div>
    </form>
  );
}
