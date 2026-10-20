"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/design/Button";
import { Icon } from "@/design/icons";
import { toast } from "@/design/toast";
import { addStarterSticker, removeStarterSticker } from "@/lib/admin/content-actions";
import { imageExt, makeSticker, STARTER_BUCKET, starterUrl } from "@/lib/chat/media";
import { supabaseBrowser } from "@/lib/supabase/browser";

const MAX_FILES = 200;

async function hashOf(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest).slice(0, 10), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function StarterStickers({ items }: { items: { id: string; path: string; animated: boolean }[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    const list = Array.from(files ?? []).slice(0, MAX_FILES);
    if (!list.length) return;
    const sb = supabaseBrowser();
    let added = 0;
    let dupes = 0;
    const failed: string[] = [];
    setProgress({ done: 0, total: list.length });
    for (const [i, file] of list.entries()) {
      try {
        const { blob, type, animated } = await makeSticker(file);
        // Named by content, so the same sticker uploaded twice is only stored once.
        const path = `starter/${await hashOf(blob)}.${imageExt(type)}`;
        const { error } = await sb.storage.from(STARTER_BUCKET).upload(path, blob, { contentType: type, upsert: false, cacheControl: "31536000" });
        if (error && !/exists|duplicate/i.test(error.message)) throw new Error(error.message);
        const res = await addStarterSticker(path, animated);
        if (!res.ok) throw new Error(res.error);
        if (res.data.duplicate) dupes++;
        else added++;
      } catch {
        failed.push(file.name);
      }
      setProgress({ done: i + 1, total: list.length });
    }
    setProgress(null);
    if (input.current) input.current.value = "";
    if (added) toast.success(`${added} sticker${added === 1 ? "" : "s"} added.`, dupes ? `${dupes} were already in the pack.` : undefined);
    else if (dupes) toast.info("Those are already in the pack.");
    if (failed.length) toast.error(`${failed.length} couldn't be added.`, failed.slice(0, 3).join(", ") + (failed.length > 3 ? "…" : ""));
    router.refresh();
  }

  async function remove(id: string) {
    setRemoving(id);
    const res = await removeStarterSticker(id);
    setRemoving(null);
    if (!res.ok) return void toast.error(res.error);
    router.refresh();
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button icon="plus" onClick={() => input.current?.click()} loading={!!progress}>
          {progress ? `Uploading ${progress.done}/${progress.total}` : "Upload stickers"}
        </Button>
        {items.length ? (
          <Button variant="ghost" onClick={() => setEditing((e) => !e)}>
            {editing ? "Done" : "Remove some"}
          </Button>
        ) : null}
        <span className="ml-auto text-[0.85rem] text-muted">{items.length} in the pack</span>
      </div>
      <input ref={input} type="file" accept="image/webp,image/png,image/gif,image/jpeg" multiple hidden onChange={(e) => void upload(e.target.files)} />

      {items.length ? (
        <ul className="mt-6 grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          {items.map((s, i) => (
            <li key={s.id} className="relative rounded-[14px] border border-line bg-raised p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- public storage URLs, already sized */}
              <img src={starterUrl(s.path)} alt={`Starter sticker ${i + 1}`} loading="lazy" className="aspect-square w-full object-contain" />
              {editing ? (
                <button
                  type="button"
                  onClick={() => void remove(s.id)}
                  disabled={removing === s.id}
                  aria-label={`Remove starter sticker ${i + 1}`}
                  className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-bg bg-accent-ink text-bg disabled:opacity-50"
                >
                  <Icon name="close" size={13} strokeWidth={2.4} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-10 text-center text-muted">The pack is empty. Upload a few and every couple will see them under “Starter pack”.</p>
      )}
    </div>
  );
}
