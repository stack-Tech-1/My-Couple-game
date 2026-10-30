"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type PointerEvent as RPointerEvent } from "react";
import { Button } from "@/design/Button";
import { TextField } from "@/design/Field";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { addPicture, deletePicture, movePicture, updatePicture } from "@/lib/solo/fixam-admin";

export type AdminPicture = {
  id: string;
  name: string;
  place: string;
  note: string;
  link: string | null;
  own_photo: boolean;
  credit: string | null;
  live: boolean;
  feature_on: string | null;
  url: string;
};

const EDGE = 1080; // saved size, square
const VIEW = 300; // crop box on screen

type Details = Omit<AdminPicture, "id" | "url">;
const BLANK: Details = { name: "", place: "", note: "", link: "", own_photo: false, credit: "", live: true, feature_on: "" };

function DetailsForm({ value, onChange }: { value: Details; onChange: (d: Details) => void }) {
  const set = (k: keyof Details, v: unknown) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField label="Name" value={value.name} onChange={(e) => set("name", e.target.value)} maxLength={60} placeholder="Olumo Rock" />
      <TextField label="Place" value={value.place} onChange={(e) => set("place", e.target.value)} maxLength={80} placeholder="Abeokuta, Ogun State" />
      <div className="sm:col-span-2">
        <TextField label="A line about it" value={value.note} onChange={(e) => set("note", e.target.value)} maxLength={200} placeholder="Climb the steps and all of Abeokuta is below you." />
      </div>
      <div className="sm:col-span-2">
        <TextField label='"See the real place" link (optional)' value={value.link ?? ""} onChange={(e) => set("link", e.target.value)} maxLength={300} placeholder="https://…" />
      </div>
      <label className="flex items-center gap-2.5 font-semibold sm:col-span-2">
        <input type="checkbox" className="h-5 w-5" checked={value.own_photo} onChange={(e) => set("own_photo", e.target.checked)} />
        Our own photo (no credit shown)
      </label>
      {!value.own_photo ? (
        <div className="sm:col-span-2">
          <TextField label="Credit (shown under the picture)" value={value.credit ?? ""} onChange={(e) => set("credit", e.target.value)} maxLength={200} placeholder="Photo: Jane Doe, CC BY 4.0, Wikimedia Commons" />
        </div>
      ) : null}
      <label className="flex items-center gap-2.5 font-semibold">
        <input type="checkbox" className="h-5 w-5" checked={value.live} onChange={(e) => set("live", e.target.checked)} />
        Live
      </label>
      <label className="block">
        <span className="text-[0.82rem] font-semibold">Special day (optional)</span>
        <input type="date" value={value.feature_on ?? ""} onChange={(e) => set("feature_on", e.target.value)} className="mt-1 block h-11 w-full rounded-[12px] border-[1.5px] border-line bg-raised px-3" />
      </label>
    </div>
  );
}

/** Upload, drag to frame a square, check how it looks as tiles, then save. */
function AddPicture() {
  const router = useRouter();
  const [src, setSrc] = useState<string | null>(null);
  const img = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [grid, setGrid] = useState(4);
  const [d, setD] = useState<Details>(BLANK);
  const [rights, setRights] = useState(false);
  const [pending, start] = useTransition();
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // Image size on screen at zoom 1: the short side fills the crop box.
  const base = () => {
    const i = img.current;
    if (!i) return { w: VIEW, h: VIEW };
    const s = VIEW / Math.min(i.naturalWidth, i.naturalHeight);
    return { w: i.naturalWidth * s, h: i.naturalHeight * s };
  };
  const clamp = (x: number, y: number, z = zoom) => {
    const b = base();
    const w = b.w * z;
    const h = b.h * z;
    return { x: Math.min(0, Math.max(VIEW - w, x)), y: Math.min(0, Math.max(VIEW - h, y)) };
  };

  const pick = (f: File | undefined) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    const i = new Image();
    i.onload = () => {
      img.current = i;
      setZoom(1);
      const b = base();
      setOff({ x: (VIEW - b.w) / 2, y: (VIEW - b.h) / 2 });
      setSrc(url);
    };
    i.src = url;
  };

  useEffect(() => () => void (src && URL.revokeObjectURL(src)), [src]);

  const onDown = (e: RPointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
  };
  const onMove = (e: RPointerEvent) => {
    const g = drag.current;
    if (g) setOff(clamp(g.ox + e.clientX - g.x, g.oy + e.clientY - g.y));
  };

  const exportCrop = async (): Promise<Blob | null> => {
    const i = img.current;
    if (!i) return null;
    const b = base();
    const scale = i.naturalWidth / (b.w * zoom);
    const c = document.createElement("canvas");
    c.width = EDGE;
    c.height = EDGE;
    c.getContext("2d")!.drawImage(i, -off.x * scale, -off.y * scale, VIEW * scale, VIEW * scale, 0, 0, EDGE, EDGE);
    // Keep it under 1 MB so it uploads quickly.
    for (const q of [0.86, 0.78, 0.7, 0.6]) {
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/webp", q));
      if (blob && blob.size < 950_000) return blob;
    }
    return null;
  };

  const save = () =>
    start(async () => {
      const blob = await exportCrop();
      if (!blob) return void toast.error("Couldn't prepare that photo. Try a smaller one.");
      const form = new FormData();
      form.set("file", blob, "picture.webp");
      form.set("rights", rights ? "yes" : "no");
      form.set("details", JSON.stringify(d));
      const r = await addPicture(form);
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${d.name} added.`);
      setSrc(null);
      setD(BLANK);
      setRights(false);
      router.refresh();
    });

  const b = src ? base() : { w: VIEW, h: VIEW };
  return (
    <div className="grid gap-6 md:grid-cols-[auto_1fr]">
      <div>
        {src ? (
          <>
            <div
              className="relative touch-none overflow-hidden rounded-[16px] border-[2px] border-[#1c1416] bg-sunk"
              style={{ width: VIEW, height: VIEW }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={() => (drag.current = null)}
              aria-label="Drag to choose the square crop"
              role="img"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen file */}
              <img src={src} alt="" draggable={false} className="pointer-events-none absolute max-w-none select-none" style={{ left: off.x, top: off.y, width: b.w * zoom, height: b.h * zoom }} />
              <div aria-hidden className="pointer-events-none absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${grid}, 1fr)`, gridTemplateRows: `repeat(${grid}, 1fr)` }}>
                {Array.from({ length: grid * grid }, (_, k) => (
                  <span key={k} className="border border-white/70" />
                ))}
              </div>
            </div>
            <label className="mt-3 block text-[0.82rem] font-semibold">
              Zoom
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => {
                  const z = Number(e.target.value);
                  setZoom(z);
                  setOff((o) => clamp(o.x, o.y, z));
                }}
                className="block w-[300px]"
              />
            </label>
            <div role="radiogroup" aria-label="Preview tiles" className="mt-2 flex gap-1.5">
              {[3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={grid === n} onClick={() => setGrid(n)} className={cn("rounded-full border-[1.5px] px-3 py-1 text-[0.8rem] font-bold", grid === n ? "border-fg bg-raised" : "border-line")}>
                  {n}×{n}
                </button>
              ))}
            </div>
            <p className="mt-2 max-w-[300px] text-[0.78rem] text-muted">Check every tile has something on it. Plain sky tiles are hard to place.</p>
          </>
        ) : (
          <label className="flex h-[300px] w-[300px] cursor-pointer flex-col items-center justify-center rounded-[16px] border-[2px] border-dashed border-line-strong text-center text-muted">
            <span className="font-bold text-fg">Choose a photo</span>
            <span className="mt-1 text-[0.82rem]">JPG, PNG or WebP. You&apos;ll crop it square next.</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
        )}
      </div>
      <div>
        <DetailsForm value={d} onChange={setD} />
        <label className="mt-4 flex items-start gap-2.5 rounded-[14px] bg-sunk p-3 text-[0.9rem]">
          <input type="checkbox" className="mt-0.5 h-5 w-5" checked={rights} onChange={(e) => setRights(e.target.checked)} />
          <span>I took this photo or have permission to use it, and the credit above is right.</span>
        </label>
        <div className="mt-4 flex gap-3">
          <Button loading={pending} disabled={!src || !d.name.trim() || !rights} onClick={save}>
            Save picture
          </Button>
          {src ? (
            <Button variant="ghost" onClick={() => setSrc(null)}>
              Choose another
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({ p, first, last }: { p: AdminPicture; first: boolean; last: boolean }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [d, setD] = useState<Details>({ ...p, link: p.link ?? "", credit: p.credit ?? "", feature_on: p.feature_on ?? "" });
  const [pending, start] = useTransition();
  const run = (f: () => Promise<{ ok: boolean; error?: string }>, msg?: string) =>
    start(async () => {
      const r = await f();
      if (!r.ok) return void toast.error((r as { error: string }).error);
      if (msg) toast.success(msg);
      setEdit(false);
      router.refresh();
    });
  return (
    <li className="border-t border-line py-3 first:border-t-0">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo from storage */}
        <img src={p.url} alt="" className="h-16 w-16 shrink-0 rounded-[10px] object-cover" />
        <div className="min-w-0 flex-1">
          <p className={cn("font-semibold", !p.live && "text-muted")}>
            {p.name} {!p.live ? <span className="text-[0.78rem] font-normal">(hidden)</span> : null}
            {p.feature_on ? <span className="ml-1 text-[0.78rem] font-normal text-muted">· {p.feature_on}</span> : null}
          </p>
          <p className="truncate text-[0.8rem] text-muted">{p.own_photo ? "Our own photo" : p.credit}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" aria-label={`Move ${p.name} up`} disabled={first || pending} onClick={() => run(() => movePicture(p.id, "up"))} className="h-9 w-9 rounded-full hover:bg-sunk disabled:opacity-30">↑</button>
          <button type="button" aria-label={`Move ${p.name} down`} disabled={last || pending} onClick={() => run(() => movePicture(p.id, "down"))} className="h-9 w-9 rounded-full hover:bg-sunk disabled:opacity-30">↓</button>
          <Button size="sm" variant="ghost" onClick={() => setEdit((e) => !e)}>{edit ? "Close" : "Edit"}</Button>
        </div>
      </div>
      {edit ? (
        <div className="mt-3 rounded-[14px] bg-sunk p-3">
          <DetailsForm value={d} onChange={setD} />
          <div className="mt-3 flex flex-wrap gap-3">
            <Button size="sm" loading={pending} onClick={() => run(() => updatePicture(p.id, d), "Saved.")}>Save</Button>
            <Button size="sm" variant="danger" disabled={pending} onClick={() => confirm(`Delete ${p.name}? This can't be undone.`) && run(() => deletePicture(p.id), "Deleted.")}>
              Delete
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function FixamAdmin({ pictures }: { pictures: AdminPicture[] }) {
  return (
    <div className="mt-8 space-y-8">
      <section aria-labelledby="add-h" className="rounded-[18px] border border-line bg-raised p-5">
        <h2 id="add-h" className="text-[0.95rem] font-semibold">Add a picture</h2>
        <div className="mt-4">
          <AddPicture />
        </div>
      </section>
      <section aria-labelledby="all-h" className="rounded-[18px] border border-line bg-raised p-5">
        <h2 id="all-h" className="text-[0.95rem] font-semibold">All pictures ({pictures.length})</h2>
        <p className="mt-0.5 text-[0.8rem] text-muted">In collection order. Today&apos;s picture takes turns through the live ones, unless one is set for that day.</p>
        {pictures.length ? (
          <ul className="mt-3">
            {pictures.map((p, i) => (
              <Row key={p.id} p={p} first={i === 0} last={i === pictures.length - 1} />
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-muted">No pictures yet. Add the first one above.</p>
        )}
      </section>
    </div>
  );
}
