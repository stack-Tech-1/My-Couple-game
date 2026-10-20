"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/design/Button";
import { TextArea, TextField } from "@/design/Field";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { createAnnouncement, endAnnouncement } from "@/lib/admin/actions";
import type { AdminAnnouncement } from "@/lib/admin/server";
import { AnnouncementBar, type Announcement } from "@/components/room/AnnouncementBar";

const TONES: { key: Announcement["tone"]; label: string }[] = [
  { key: "info", label: "News" },
  { key: "celebrate", label: "Celebration" },
  { key: "heads_up", label: "Heads-up" },
];
const DURATIONS = [
  { days: 1, label: "1 day" },
  { days: 3, label: "3 days" },
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
  { days: 30, label: "30 days" },
  { days: null, label: "Until I end it" },
] as const;

function status(a: AdminAnnouncement): { label: string; live: boolean } {
  const now = Date.now();
  if (Date.parse(a.starts_at) > now) return { label: "Scheduled", live: false };
  if (a.ends_at && Date.parse(a.ends_at) <= now) return { label: "Ended", live: false };
  return { label: a.ends_at ? `Live until ${new Date(a.ends_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "Live", live: true };
}

export function AnnouncementTools({ items }: { items: AdminAnnouncement[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState<Announcement["tone"]>("info");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [days, setDays] = useState<number | null>(7);
  const [pending, start] = useTransition();

  function publish(e: FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await createAnnouncement({ title, body, tone, link_url: linkUrl, link_label: linkLabel, days });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Announcement is live.", "It shows on everyone's next page load.");
      setTitle("");
      setBody("");
      setLinkUrl("");
      setLinkLabel("");
      router.refresh();
    });
  }

  function end(id: string) {
    start(async () => {
      const res = await endAnnouncement(id);
      if (!res.ok) return void toast.error(res.error);
      router.refresh();
    });
  }

  const preview: Announcement = { id: "preview", title: title || "Your title", body: body || "Your message shows here.", tone, link_url: linkUrl || null, link_label: linkLabel || null };

  return (
    <div className="mt-8">
      <form onSubmit={publish} className="rounded-[18px] border border-line bg-raised p-5">
        <h2 className="text-[0.95rem] font-semibold">New announcement</h2>
        <div className="mt-4 flex flex-col gap-4">
          <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required placeholder="Ludo just landed" />
          <TextArea label="Message" value={body} onChange={(e) => setBody(e.target.value)} maxLength={600} rows={3} required placeholder="Roll the dice tonight. It's in the library under Head to head." hint={`${body.length}/600`} />
          <fieldset>
            <legend className="text-[0.82rem] font-semibold">Style</legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {TONES.map((t) => (
                <label key={t.key} className={cn("cursor-pointer rounded-full border-[1.5px] px-3.5 py-1.5 text-[0.85rem] font-semibold", tone === t.key ? "border-fg bg-fg text-bg" : "border-line text-muted hover:text-fg")}>
                  <input type="radio" name="tone" value={t.key} checked={tone === t.key} onChange={() => setTone(t.key)} className="sr-only" />
                  {t.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <TextField label="Link (optional)" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://… or /room" />
            <TextField label="Link text" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} maxLength={30} placeholder="Take a look" />
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.82rem] font-semibold">Show it for</span>
            <select
              value={days === null ? "forever" : String(days)}
              onChange={(e) => setDays(e.target.value === "forever" ? null : Number(e.target.value))}
              className="h-12 rounded-[var(--radius)] border-[1.5px] border-line bg-raised px-3 text-[1rem]"
            >
              {DURATIONS.map((d) => (
                <option key={d.label} value={d.days === null ? "forever" : String(d.days)}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-6 text-[0.82rem] font-semibold">Preview</p>
        <div className="-mx-4 sm:-mx-8">
          <AnnouncementBar items={[preview]} />
        </div>
        <div className="mt-5 flex justify-end">
          <Button type="submit" loading={pending}>
            Publish
          </Button>
        </div>
      </form>

      <section aria-labelledby="past-h" className="mt-10">
        <h2 id="past-h" className="eyebrow border-t-[1.5px] border-line-strong pt-4 text-muted">
          Recent
        </h2>
        {items.length ? (
          <ul className="mt-2 divide-y divide-line">
            {items.map((a) => {
              const s = status(a);
              return (
                <li key={a.id} className="flex items-start gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{a.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-[0.88rem] text-muted">{a.body}</p>
                    <p className={cn("mt-1.5 text-[0.75rem] font-semibold", s.live ? "text-accent-ink" : "text-muted")}>
                      {s.label} · posted {new Date(a.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  {s.live || s.label === "Scheduled" ? (
                    <Button variant="outline" size="sm" onClick={() => end(a.id)} disabled={pending}>
                      End now
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 text-muted">Nothing posted yet.</p>
        )}
      </section>
    </div>
  );
}
