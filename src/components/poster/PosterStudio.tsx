"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/design/Button";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { POSTER_STYLES, STYLE_NAMES, defaultStyle, type PosterData, type PosterStyle } from "@/lib/poster/styles";
import { sharePoster } from "@/components/solo/poster";
import { photoForPoster, posterMarkup, renderPoster } from "./render";

const PHOTO_STYLES = new Set<PosterStyle>(["studio", "nollywood"]);

/**
 * Pick a poster: four styles side by side to swipe through, an optional photo (Studio and
 * Nollywood), then share or save. Everything is drawn on the phone; a photo never leaves it.
 */
export function PosterStudio({ data, shareText, link = "https://playamah.app", fileName = "amah" }: { data: PosterData; shareText: string; link?: string; fileName?: string }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [style, setStyle] = useState<PosterStyle>(() => defaultStyle(data));
  const [previews, setPreviews] = useState<Partial<Record<PosterStyle, string>>>({});
  const [busy, setBusy] = useState(false);
  const rail = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const full: PosterData = { ...data, photo };

  // Previews: each style drawn as a picture the browser can show. Redrawn when the photo changes.
  useEffect(() => {
    let alive = true;
    const urls: string[] = [];
    void Promise.all(
      POSTER_STYLES.map(async (s) => {
        const svg = await posterMarkup(s, { ...data, photo: PHOTO_STYLES.has(s) ? photo : null });
        const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
        urls.push(url);
        return [s, url] as const;
      }),
    ).then((pairs) => alive && setPreviews(Object.fromEntries(pairs)));
    return () => {
      alive = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [data, photo]);

  // Bring the chosen style into view (chips, or a newly added photo).
  const show = (s: PosterStyle) => {
    setStyle(s);
    rail.current?.querySelector<HTMLElement>(`[data-style="${s}"]`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };
  useEffect(() => {
    rail.current?.querySelector<HTMLElement>(`[data-style="${style}"]`)?.scrollIntoView({ inline: "center", block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the previews first appear
  }, [!!previews[style]]);
  // Swiping: the card nearest the middle is the one chosen.
  const onScroll = () => {
    const el = rail.current;
    if (!el) return;
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best: PosterStyle = style;
    let gap = Infinity;
    el.querySelectorAll<HTMLElement>("[data-style]").forEach((c) => {
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
      if (d < gap) {
        gap = d;
        best = c.dataset.style as PosterStyle;
      }
    });
    if (best !== style) setStyle(best);
  };

  async function pick(file: File | undefined) {
    if (!file) return;
    try {
      setPhoto(await photoForPoster(file));
      show("studio");
    } catch {
      toast.error("That photo didn't open.", "Try a different one.");
    }
  }

  async function share() {
    setBusy(true);
    try {
      const blob = await renderPoster(style, { ...full, photo: PHOTO_STYLES.has(style) ? photo : null });
      const how = await sharePoster(blob, shareText, link);
      if (how === "copied") toast.success("Poster saved and message copied.", "Paste it anywhere.");
    } catch {
      toast.error("The poster didn't draw.", "Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      const blob = await renderPoster(style, { ...full, photo: PHOTO_STYLES.has(style) ? photo : null });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${fileName}-${style}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch {
      toast.error("The poster didn't draw.", "Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div ref={rail} onScroll={onScroll} className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-[calc(50%-110px)] pb-1 [scrollbar-width:none]" role="listbox" aria-label="Poster styles">
        {POSTER_STYLES.map((s) => (
          <button
            key={s}
            type="button"
            data-style={s}
            role="option"
            aria-selected={style === s}
            aria-label={`${STYLE_NAMES[s]} poster`}
            onClick={() => show(s)}
            className={cn("aspect-[9/16] w-[220px] shrink-0 snap-center overflow-hidden rounded-[16px] border-2 bg-sunk transition-[transform,opacity] duration-200", style === s ? "border-fg" : "scale-[.94] border-transparent opacity-70")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a local preview drawn on the phone */}
            {previews[s] ? <img src={previews[s]} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[0.85rem] text-muted">Drawing…</span>}
          </button>
        ))}
      </div>
      <div className="flex justify-center gap-1.5" role="group" aria-label="Choose a style">
        {POSTER_STYLES.map((s) => (
          <button key={s} type="button" onClick={() => show(s)} aria-pressed={style === s} className={cn("rounded-full px-3 py-1.5 text-[0.82rem] font-bold", style === s ? "bg-fg text-bg" : "text-muted hover:text-fg")}>
            {STYLE_NAMES[s]}
          </button>
        ))}
      </div>

      <div className="rounded-[16px] border border-line px-4 py-3">
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} aria-label="Choose a photo for the poster" />
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{photo ? "Your photo is on it" : "Add a photo of you"}</p>
            <p className="text-[0.8rem] text-muted">{photo ? "Shows on Studio and Nollywood." : "For Studio and Nollywood."} It stays on this phone.</p>
          </div>
          {photo ? (
            <button type="button" className="text-[0.85rem] font-bold underline" onClick={() => setPhoto(null)}>
              Remove
            </button>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            {photo ? "Change" : "Add photo"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Button size="lg" loading={busy} onClick={() => void share()}>
          Share
        </Button>
        <Button size="lg" variant="outline" disabled={busy} onClick={() => void save()}>
          Save image
        </Button>
      </div>
      <p className="text-center text-[0.8rem] text-muted">Only names and numbers go on it. Pet names, chats and answers never do.</p>
    </div>
  );
}
