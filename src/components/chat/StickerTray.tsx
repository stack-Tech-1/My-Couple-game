"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/design/icons";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { imageExt, makeSticker, PRIVATE_BUCKET } from "@/lib/chat/media";
import { stickerMediaSchema, type StickerMedia } from "@/lib/chat/types";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { StickerImage } from "./Bubbles";

type Row = { id: string; room_id: string | null; path: string; animated: boolean };
type Tab = "recent" | "starter" | "ours";

const toMedia = (r: Row): StickerMedia => ({ sticker_id: r.id, path: r.path, scope: r.room_id ? "room" : "starter", ...(r.animated ? { animated: true } : {}) });

// Recently used stickers are a per-device convenience, so localStorage is the right home.
const RECENT_MAX = 16;
const recentKey = (roomId: string) => `amah:stickers:recent:${roomId}`;
function readRecent(roomId: string): StickerMedia[] {
  try {
    const raw = JSON.parse(localStorage.getItem(recentKey(roomId)) ?? "[]") as unknown[];
    return raw.flatMap((r) => {
      const p = stickerMediaSchema.safeParse(r);
      return p.success ? [p.data] : [];
    });
  } catch {
    return [];
  }
}
function pushRecent(roomId: string, m: StickerMedia) {
  try {
    const next = [m, ...readRecent(roomId).filter((r) => r.sticker_id !== m.sticker_id)].slice(0, RECENT_MAX);
    localStorage.setItem(recentKey(roomId), JSON.stringify(next));
  } catch {
    // private mode or storage blocked: recents just won't stick
  }
}

export function StickerTray({ roomId, me, onPick }: { roomId: string; me: string; onPick: (m: StickerMedia) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [recent, setRecent] = useState<StickerMedia[]>([]);
  const [tab, setTab] = useState<Tab>("starter");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabaseBrowser().from("stickers").select("id, room_id, path, animated").order("sort").order("created_at", { ascending: false }).limit(500);
    setRows((data ?? []) as Row[]);
  }, []);

  useEffect(() => {
    void load();
    const r = readRecent(roomId);
    setRecent(r);
    if (r.length) setTab("recent");
  }, [load, roomId]);

  const starter = rows?.filter((r) => !r.room_id) ?? [];
  const ours = rows?.filter((r) => r.room_id === roomId) ?? [];
  // Recents whose sticker has since been removed shouldn't linger.
  const liveIds = new Set(rows?.map((r) => r.id));
  const recentLive = rows ? recent.filter((m) => liveIds.has(m.sticker_id)) : recent;

  function pick(m: StickerMedia) {
    pushRecent(roomId, m);
    setRecent(readRecent(roomId));
    onPick(m);
  }

  async function create(files: FileList | null) {
    const list = Array.from(files ?? []).slice(0, 12);
    if (!list.length) return;
    setBusy(true);
    const sb = supabaseBrowser();
    let added = 0;
    for (const file of list) {
      try {
        const { blob, type, animated } = await makeSticker(file);
        const path = `${roomId}/stickers/${crypto.randomUUID()}.${imageExt(type)}`;
        const { error: up } = await sb.storage.from(PRIVATE_BUCKET).upload(path, blob, { contentType: type, upsert: false });
        if (up) throw new Error(up.message);
        const { error } = await sb.from("stickers").insert({ room_id: roomId, path, animated, created_by: me });
        if (error) {
          await sb.storage.from(PRIVATE_BUCKET).remove([path]);
          throw new Error(error.message.includes("rate limited") ? "That's a lot of stickers for one hour. Try again later." : "Couldn't save that sticker.");
        }
        added++;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't make that sticker.");
      }
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    if (added) {
      await load();
      setTab("ours");
    }
  }

  async function remove(r: Row) {
    const sb = supabaseBrowser();
    const { error } = await sb.from("stickers").delete().eq("id", r.id);
    if (error) return toast.error("Couldn't remove that sticker.");
    // The file stays if a message already uses it; only the uploader can delete it anyway.
    setRows((cur) => cur?.filter((x) => x.id !== r.id) ?? null);
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "recent", label: "Recent" },
    { key: "starter", label: "Starter pack" },
    { key: "ours", label: "Ours" },
  ];

  const grid = (items: StickerMedia[], removable?: Row[]) => (
    <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5">
      {tab === "ours" ? (
        <li>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-[14px] border-[1.5px] border-dashed border-line text-[0.72rem] font-semibold text-muted hover:border-line-strong hover:text-fg disabled:opacity-50"
          >
            {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Icon name="plus" size={20} />}
            {busy ? "Making…" : "Create"}
          </button>
        </li>
      ) : null}
      {items.map((m, i) => (
        <li key={m.sticker_id} className="relative">
          <button type="button" onClick={() => pick(m)} disabled={editing} aria-label={`Send sticker ${i + 1}`} className="block aspect-square w-full rounded-[14px] p-1 hover:bg-sunk focus-visible:bg-sunk">
            <StickerImage media={m} size={72} className="h-full w-full" />
          </button>
          {editing && removable?.[i] ? (
            <button
              type="button"
              onClick={() => remove(removable[i]!)}
              aria-label={`Remove sticker ${i + 1}`}
              className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-bg bg-accent-ink text-bg"
            >
              <Icon name="close" size={12} strokeWidth={2.4} />
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex h-[min(19rem,42vh)] flex-col border-t border-line bg-raised">
      <div className="flex items-center gap-1 px-2 pt-2" role="tablist" aria-label="Stickers">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => {
              setTab(t.key);
              setEditing(false);
            }}
            className={cn("rounded-full px-3 py-1.5 text-[0.8rem] font-semibold", tab === t.key ? "bg-fg text-bg" : "text-muted hover:text-fg")}
          >
            {t.label}
          </button>
        ))}
        {tab === "ours" && ours.length ? (
          <button type="button" onClick={() => setEditing((e) => !e)} className="ml-auto px-2 text-[0.8rem] font-semibold text-accent-ink">
            {editing ? "Done" : "Edit"}
          </button>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain p-3" role="tabpanel">
        {rows === null ? (
          <p className="py-8 text-center text-[0.85rem] text-muted">Fetching stickers…</p>
        ) : tab === "recent" ? (
          recentLive.length ? grid(recentLive) : <p className="py-8 text-center text-[0.85rem] text-muted">Stickers you send show up here.</p>
        ) : tab === "starter" ? (
          starter.length ? grid(starter.map(toMedia)) : <p className="py-8 text-center text-[0.85rem] text-muted">The starter pack is empty for now. Make your own under “Ours”.</p>
        ) : (
          <>
            {grid(ours.map(toMedia), ours)}
            {!ours.length ? <p className="pt-4 text-center text-[0.82rem] text-muted">Turn any photo into a sticker only the two of you can use. Animated GIFs work too.</p> : null}
          </>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={(e) => void create(e.target.files)} />
    </div>
  );
}
