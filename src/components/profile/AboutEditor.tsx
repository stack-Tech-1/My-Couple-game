"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/Button";
import { toast } from "@/design/toast";
import { setAbout } from "@/lib/room/actions";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { ABOUT_FIELDS, type About, type AboutKey } from "@/lib/room/types";

const KEYS = Object.keys(ABOUT_FIELDS) as AboutKey[];

/** Your About me favourites, shown when someone taps your face. */
export function AboutEditor() {
  const { bundle } = useRoom();
  const router = useRouter();
  const saved = bundle.me.profile.about ?? {};
  const [values, setValues] = useState<About>(saved);
  const [pending, start] = useTransition();
  const changed = KEYS.some((k) => (values[k] ?? "").trim() !== (saved[k] ?? ""));

  function save(e: FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await setAbout(values);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Saved. Your people can tap your face to see it.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="mt-8" aria-labelledby="about-label">
      <p id="about-label" className="text-[0.82rem] font-semibold">About you</p>
      <p className="mt-1 text-[0.85rem] text-muted">A few favourites for your people. They see them when they tap your face. All optional.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {KEYS.map((k) => (
          <label key={k} className={k === "line" ? "sm:col-span-2" : undefined}>
            <span className="block text-[0.78rem] text-muted">{ABOUT_FIELDS[k].label}</span>
            <input
              value={values[k] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
              maxLength={ABOUT_FIELDS[k].max}
              placeholder={ABOUT_FIELDS[k].placeholder}
              className="mt-1 h-11 w-full rounded-[12px] border-[1.5px] border-line bg-raised px-3 font-semibold placeholder:font-normal placeholder:text-muted focus:border-line-strong focus:outline-none"
            />
          </label>
        ))}
      </div>
      <Button type="submit" size="sm" className="mt-3" variant={changed ? "accent" : "ghost"} disabled={!changed} loading={pending}>
        Save
      </Button>
    </form>
  );
}
